import { Comprobantes } from '../../../../core/services/comprobantes';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Generales } from '../../../../core/services/generales';
import { DetallesComprobante } from '../../../../core/services/detalles-comprobante';
import { Comprobante, ComprobanteCreate, DetalleComprobante, DetalleComprobanteCreate, General } from '../../../../core/mapped';
import {Movimientos} from '../../../../core/services/movimientos';
import {DetalleMovimientos} from '../../../../core/services/detalle-movimientos';

@Component({
  selector: 'feature-comprobantes-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comprobantes.html',
})
export class ComprobantesModalComponent implements OnInit, OnChanges {
  @Input() show = false;
  @Input() estado: 'P' | 'B' = 'P';
  @Input() comprobanteId: number | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<number>();
 
  cabecera: Partial<ComprobanteCreate> = {
    tipo_comprobante: undefined as any,
    numero_comprobante: undefined as any,
    forma_pago: undefined as any,
    precio_total: 0,
    fecha_comprobante: '',
    impuesto: 0,
    serie: '',
    numero: '',
  } as any;
 
  cabeceraId: number | null = null;
  detalle: DetalleComprobante[] = [];
 
  nuevoItem: Partial<DetalleComprobanteCreate> = {
    cantidad: undefined as any,
    descripcion: undefined as any,
    precio_unitario: undefined as any,
  } as any;
 
  guardandoCabecera = false;
  errorCabecera: string | null = null;
  errorDetalle: string | null = null;
 
  // Generales catálogos
  generales: General[] = [];
  tiposComprobante: General[] = [];
  formasPago: General[] = [];
 
  finalizando = false;
  movimientoCreado = false;
  errorMovimiento = "";
 
  constructor(
    private readonly comprobantesSrv: Comprobantes,
    private readonly detallesSrv: DetallesComprobante,
    private readonly generalesSrv: Generales,
    private readonly movimientosSrv: Movimientos,
    private readonly detalleMovSrv: DetalleMovimientos,
  ) {}
 
  private loadExisting(id: number){
    this.cabeceraId = id;
    this.comprobantesSrv.getComprobantes().subscribe({
      next: (list:any[]) => {
        const f = (list||[]).find(x=> Number((x as any).id)===Number(id));
        if(f){
          const c: any = f;
          this.cabecera = {
            tipo_comprobante: c.tipo_comprobante,
            numero_comprobante: c.numero_comprobante,
            forma_pago: c.forma_pago,
            precio_total: c.precio_total,
            fecha_comprobante: c.fecha_comprobante,
            impuesto: c.impuesto,
            serie: c.serie,
            numero: c.numero,
          } as any;
        }
        this.detallesSrv.getDetalles(Number(id)).subscribe({ next: (ds)=>{ this.detalle = ds||[]; }, error: ()=>{} });
      },
      error: ()=>{ /* no-op */ }
    });
  }
 
  ngOnInit(): void {
    if (this.comprobanteId) { this.loadExisting(this.comprobanteId); }
    this.generalesSrv.getGenerales().subscribe({
      next: (gs: General[]) => {
        this.generales = gs || [];
        this.tiposComprobante = (this.generales || []).filter(g => Number((g as any).codigo_principal) === 1);
        this.formasPago = (this.generales || []).filter(g => Number((g as any).codigo_principal) === 3);
      },
      error: () => { /* no-op */ }
    });
  }
 
  get validaCabecera(): boolean {
    const c: any = this.cabecera;
    const okTipo = Number(c.tipo_comprobante) >= 0;
    const okNumComp = String(c.numero_comprobante) >= '';
    const okForma = Number(c.forma_pago) >= 0;
    const okFecha = String(c.fecha_comprobante || '').trim().length > 0;
    return okTipo && okNumComp && okForma && okFecha;
  }

  get validaItem(): boolean {
    const i: any = this.nuevoItem;
    const okCant = Number(i.cantidad) > 0;
    const okDesc = String(i.descripcion || '').trim().length > 0;
    const okPU = Number(i.precio_unitario) > 0;
    return okCant && okDesc && okPU;
  }

  get totalCalculado(): number {
    return (this.detalle || []).reduce((acc, it: any) => acc + (Number(it.cantidad) * Number(it.precio_unitario)), 0);
  }

  onClose() { this.close.emit(); }

  guardarCabecera() {
    if (!this.validaCabecera || this.guardandoCabecera) return;
    this.guardandoCabecera = true;
    this.errorCabecera = null;
    const c: any = this.cabecera;
    const body: Partial<ComprobanteCreate> = {
      tipo_comprobante: Number(c.tipo_comprobante),
      numero_comprobante: String(c.numero_comprobante),
      forma_pago: Number(c.forma_pago),
      precio_total: Number(c.precio_total) || 0,
      fecha_comprobante: String(c.fecha_comprobante || '').trim(),
      impuesto: Number(c.impuesto) || 0,
      serie: String(c.serie || '').trim(),
      numero: String(c.numero || '').trim(),
      estado_comprobante: this.estado,
    } as any;

    this.comprobantesSrv.createComprobantes(body).subscribe({
      next: (res: Comprobante) => {
        this.cabeceraId = (res as any).id;
        this.guardandoCabecera = false;
      },
      error: () => {
        this.guardandoCabecera = false;
        this.errorCabecera = 'No se pudo guardar el comprobante';
      }
    });
  }

  agregarItem() {
    if (!this.cabeceraId || !this.validaItem) return;
    this.errorDetalle = null;
    const i: any = this.nuevoItem;
    const body: Partial<DetalleComprobanteCreate> = {
      numero_item: (this.detalle.length + 1),
      cantidad: Number(i.cantidad),
      descripcion: i.descripcion as any,
      precio_unitario: Number(i.precio_unitario),
      comprobante_id: this.cabeceraId,
    } as any;

    this.detallesSrv.createDetalles(body).subscribe({
      next: (res: DetalleComprobante) => {
        const created: DetalleComprobante = {
          id: (res as any).id,
          numero_item: (res as any).numero_item ?? body.numero_item!,
          cantidad: (res as any).cantidad ?? body.cantidad!,
          descripcion: (res as any).descripcion ?? (body.descripcion as any),
          precio_unitario: (res as any).precio_unitario ?? body.precio_unitario!,
          comprobante_id: (res as any).comprobante_id ?? this.cabeceraId!,
        } as any;
        this.detalle = [...this.detalle, created];
        this.nuevoItem = { } as any;
      },
      error: () => { this.errorDetalle = 'No se pudo agregar el ítem'; }
    });
  }

  eliminarItem(it: DetalleComprobante) {
    if (!it || !(it as any).id) return;
    this.errorDetalle = null;
    this.detallesSrv.deleteDetalles((it as any).id).subscribe({
      next: () => {
        this.detalle = this.detalle.filter(d => (d as any).id !== (it as any).id)
          .map((d, idx) => ({ ...d, numero_item: idx + 1 } as any));
      },
      error: () => { this.errorDetalle = 'No se pudo eliminar el ítem'; }
    });
  }

  actualizarTotal() {
    if (!this.cabeceraId) return;
    const total = this.totalCalculado;
    this.comprobantesSrv.updateComprobantes(this.cabeceraId, { precio_total: total } as any).subscribe({
      next: (res) => { this.cabecera.precio_total = (res as any).precio_total ?? total; },
      error: () => { /* silencioso */ }
    });
  }

    finalizar() {
    if (!this.cabeceraId || this.finalizando || this.movimientoCreado) { if (this.cabeceraId && !this.finalizando && this.movimientoCreado){ this.saved.emit(this.cabeceraId); this.onClose(); } return; }
    this.finalizando = true;
    this.errorMovimiento = "";
    const total = this.totalCalculado;
    const tipoComp = Number((this.cabecera as any).tipo_comprobante);
    const serie = String((this.cabecera as any).serie || '').trim();
    const numero = String((this.cabecera as any).numero || '').trim();
    const numeroComprobante = `${serie}${numero}`;

    const afterUpdatePago = () => {
      this.movimientosSrv.createMovimientos({ tipo_movimiento: 'I', monto: total } as any).subscribe({
        next: (cab: any) => {
          const cabId = (cab as any)?.id;
          if (!cabId) { this.errorMovimiento = 'No se obtuvo ID de cabecera de movimiento'; this.finalizando = false; return; }
          this.detalleMovSrv.createDetalles({
            tipo_comprobante: tipoComp,
            numero_comprobante: numeroComprobante,
            tipo_gasto: null as any,
            descripcion: null as any,
            monto: total,
            cabecera_id: cabId,
          } as any).subscribe({
            next: () => {
              this.movimientoCreado = true;
              this.finalizando = false;
              this.saved.emit(this.cabeceraId!);
              this.onClose();
            },
            error: () => {
              this.finalizando = false;
              this.errorMovimiento = 'No se pudo crear el detalle del movimiento';
            }
          });
        },
        error: () => {
          this.finalizando = false;
          this.errorMovimiento = 'No se pudo crear la cabecera del movimiento';
        }
      });
    };

        // Actualiza total y, según estado, crea (o no) movimiento
    const doAfterUpdate = () => {
      if (this.estado === 'P') {
        afterUpdatePago();
      } else {
        this.finalizando = false;
        this.saved.emit(this.cabeceraId!);
        this.onClose();
      }
    };

    this.comprobantesSrv.updateComprobantes(this.cabeceraId, { precio_total: total, estado_comprobante: this.estado } as any).subscribe({
      next: () => doAfterUpdate(),
      error: () => doAfterUpdate(),
    });
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['comprobanteId'] && changes['comprobanteId'].currentValue) {
      const id = Number(changes['comprobanteId'].currentValue);
      if (id && (!this.cabeceraId || this.cabeceraId !== id)) {
        this.loadExisting(id);
      }
    }
  }
}
