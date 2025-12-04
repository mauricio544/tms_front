import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiAlertComponent } from '../../shared/ui/alert/alert';
import { UiConfirmComponent } from '../../shared/ui/confirm/confirm';
import { Vehiculos } from '../../../../core/services/vehiculos';
import { Vehiculo } from '../../../../core/mapped';
import { Utils } from '../../../../core/services/utils';

@Component({
  selector: 'feature-vehiculos',
  standalone: true,
  imports: [CommonModule, FormsModule, UiAlertComponent, UiConfirmComponent, Utils],
  templateUrl: './vehiculos.html',
  styleUrl: './vehiculos.css',
})
export class VehiculosFeature implements OnInit {
  private readonly vehiculoSrv = inject(Vehiculos);

  lista_vehiculos: Vehiculo[] = [];
  loading = false;
  error: string | null = null;

  // Filtros y paginación
  search = '';
  filterPlaca = '';
  filterAnio: number | null = null;
  page = 1;
  pageSize = 8;

  // Modal
  showModal = false;
  saving = false;
  saveError: string | null = null;
  // Confirmación eliminación
  confirmOpen = false;
  confirmTitle = 'Confirmar eliminación';
  confirmMessage = '';
  pendingDeleteId: number | null = null;
  pendingDeleteLabel: string = '';
  // Notif
  notif: string | null = null;
  notifType: 'success' | 'error' = 'success';

  newVehiculo: Partial<Vehiculo> = { placa: '', tonelaje: undefined as any, ejes: undefined as any, anio_fabricacion: undefined as any, fecha_vigencia_soat: '' };

  // Edición
  editing = false;
  editingId: number | null = null;

  // Lista filtrada
  get filteredVehiculos(): Vehiculo[] {
    const term = this.search.trim().toLowerCase();
    const placa = (this.filterPlaca || '').trim().toLowerCase();
    const anio = this.filterAnio ? Number(this.filterAnio) : null;
    return (this.lista_vehiculos || []).filter((v) => {
      const values = [
        v.placa || '',
        String(v.tonelaje ?? ''),
        String(v.ejes ?? ''),
        String(v.anio_fabricacion ?? ''),
        v.fecha_vigencia_soat || '',
      ].join(' ').toLowerCase();
      const okTerm = !term || values.includes(term);
      const okPlaca = !placa || (v.placa || '').toLowerCase().includes(placa);
      const okAnio = !anio || Number(v.anio_fabricacion) === anio;
      return okTerm && okPlaca && okAnio;
    });
  }

  // Derivados de paginación
  get total(): number { return this.filteredVehiculos.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageItems(): Vehiculo[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredVehiculos.slice(start, start + this.pageSize);
  }
  get pageStart(): number { return this.total ? (this.page - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageSize, this.total); }
  setPage(n: number) { this.page = Math.min(Math.max(1, n), this.totalPages); }
  onFilterChange() { this.page = 1; }

  // Modal helpers
  openModal() {
    this.editing = false;
    this.editingId = null;
    this.newVehiculo = { placa: this.normalizePlaca(''), tonelaje: undefined as any, ejes: undefined as any, anio_fabricacion: undefined as any, fecha_vigencia_soat: '' };
    this.saveError = null;
    this.showModal = true;
  }
  openEdit(item: Vehiculo) {
    this.editing = true;
    this.editingId = item.id;
    this.newVehiculo = {
      placa: this.normalizePlaca(item.placa),
      tonelaje: item.tonelaje,
      ejes: item.ejes,
      anio_fabricacion: item.anio_fabricacion as any,
      fecha_vigencia_soat: item.fecha_vigencia_soat,
    } as any;
    this.saveError = null;
    this.showModal = true;
  }
  closeModal() { this.showModal = false; }

  get isValidVehiculo(): boolean {
    const v = this.newVehiculo as any;
    const placa = this.normalizePlaca(v.placa || '');
    const placaOk = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(placa);
    const okTonelaje = Number(v.tonelaje) > 0;
    const okEjes = Number(v.ejes) >= 0; // permitir 0 si aplica
    const okAnio = !v.anio_fabricacion || (Number(v.anio_fabricacion) >= 1900 && Number(v.anio_fabricacion) <= 2100);
    return placaOk && okTonelaje && okEjes && okAnio;
  }

  normalizePlaca(value: string): string {
    const cleaned = String(value || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
    const noDash = cleaned.replace(/-/g, '');
    if (noDash.length >= 4) {
      return (noDash.slice(0, 3) + '-' + noDash.slice(3, 6)).slice(0, 7);
    }
    return cleaned.length > 3 && cleaned.indexOf('-') === -1 ? (cleaned.slice(0,3) + '-' + cleaned.slice(3)).slice(0,7) : cleaned.slice(0,7);
  }

  onPlacaChange(val: string) {
    this.newVehiculo = { ...(this.newVehiculo as any), placa: this.normalizePlaca(val) } as any;
  }

  submitNewVehiculo() {
    if (!this.isValidVehiculo) return;
    const v = this.newVehiculo as any;
    const payload = {
      placa: this.normalizePlaca(v.placa || ''),
      tonelaje: Number(v.tonelaje) || 0,
      ejes: Number(v.ejes) || 0,
      anio_fabricacion: v.anio_fabricacion ? Number(v.anio_fabricacion) : null,
      fecha_vigencia_soat: (v.fecha_vigencia_soat || '').trim() || null,
    } as any;
    this.saving = true;
    this.saveError = null;
    const obs = this.editing && this.editingId ? this.vehiculoSrv.updateVehiculo(this.editingId, payload) : this.vehiculoSrv.createVehiculo(payload);
    obs.subscribe({
      next: (res: any) => {
        const updated = {
          id: res?.id ?? (this.editingId ?? Math.max(0, ...(this.lista_vehiculos.map(x=>x.id).filter(Number))) + 1),
          placa: res?.placa ?? payload.placa,
          tonelaje: res?.tonelaje ?? payload.tonelaje,
          ejes: res?.ejes ?? payload.ejes,
          anio_fabricacion: res?.anio_fabricacion ?? payload.anio_fabricacion,
          fecha_vigencia_soat: res?.fecha_vigencia_soat ?? payload.fecha_vigencia_soat,
        } as Vehiculo;
        if (this.editing && this.editingId) {
          this.lista_vehiculos = this.lista_vehiculos.map(v => v.id === this.editingId ? updated : v);
        } else {
          this.lista_vehiculos = [updated, ...this.lista_vehiculos];
        }
        const wasEditing = this.editing;
        this.saving = false;
        this.editing = false;
        this.editingId = null;
        this.onFilterChange();
        this.closeModal();
        this.showNotif(wasEditing ? 'Vehículo actualizado' : 'Vehículo creado');
      },
      error: () => {
        this.saving = false;
        this.saveError = this.editing ? 'No se pudo actualizar' : 'No se pudo crear el vehículo';
        this.showNotif('No se pudo crear/actualizar el vehículo', 'error');
      },
    });
  }

  askDelete(item: Vehiculo) {
    this.pendingDeleteId = item.id ?? null;
    this.pendingDeleteLabel = item.placa || '';
    this.confirmMessage = `¿Eliminar vehículo ${this.pendingDeleteLabel}?`;
    this.confirmOpen = true;
  }

  onCancelDelete() {
    this.confirmOpen = false;
    this.pendingDeleteId = null;
    this.pendingDeleteLabel = '';
  }

  onConfirmDelete() {
    const id = this.pendingDeleteId;
    if (!id) { this.onCancelDelete(); return; }
    this.saving = true;
    this.vehiculoSrv.deleteVehiculo(id).subscribe({
      next: () => {
        this.lista_vehiculos = this.lista_vehiculos.filter(v => v.id !== id);
        this.saving = false;
        this.onFilterChange();
        this.onCancelDelete();
        this.showNotif('Vehículo eliminado');
      },
      error: () => {
        this.saving = false;
        this.saveError = 'No se pudo eliminar el vehículo';
        this.onCancelDelete();
        this.showNotif('No se pudo eliminar el vehículo', 'error');
      }
    })
  }

  showNotif(msg: string, type: 'success' | 'error' = 'success') {
    this.notifType = type;
    this.notif = msg;
    setTimeout(() => { this.notif = null; }, 3000);
  }

  loadVehiculos() {
    this.loading = true;
    this.error = null;
    this.vehiculoSrv.getVehiculos().subscribe({
      next: (response) => { this.lista_vehiculos = response || []; this.loading = false; },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los vehículos'; },
    });
  }

  ngOnInit(): void {
    this.loadVehiculos();
  }
}
