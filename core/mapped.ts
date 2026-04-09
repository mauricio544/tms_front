export interface Company {
  id: number;
  nombre: string;
  tipo: string,
  is_default: boolean;
  ruc: string;
  logo?: string | null;
}

export interface UsuarioMe {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  person_id: number | null;
  nombre: string;
  apellido: string;
  permissions: string[];
  companies: Company[];
  sedes: Puntos[];
}

export interface Usuario {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  password_hash: string;
  person_id: number | null;
  company_id: number | null;
  permission_type: string;
  roles: Rol[];
  permissions: string[];
  sedes: Puntos[];
}

export interface Persona {
  id: number;
  nombre: string;
  apellido: string;
  direccion: string;
  razon_social: string;
  celular: string;
  email: string;
  nro_documento: string;
  tipo_documento: string;
}

export interface PersonaListItemResponse {
  id: number;
  nombre: string;
  apellido: string;
  direccion: string;
  direccion_fiscal: string;
  ubigeo: string;
  razon_social: string;
  celular: string;
  email: string;
  nro_documento: string;
  tipo_documento: string;
  tiene_documento: boolean;
  tiene_credito?: boolean;
  limite_credito: number;
  fecha_credito:string;
}

export interface PersonaListResponse {
  items: PersonaListItemResponse[];
  total:number;
  limit: number;
  offset: number;
}

export interface PersonaTrama {
  id: number;
  nombre: string;
  apellido: string;
  razon_social: string;
  nro_documento: string;
  tipo_documento: string;
  direccion: string;
  direccion_fiscal: string;
  ubigeo: string;
  celular: string;
  email: string;
}

export interface DatosRUC {
  razon_social: string,
  numero_documento: string,
  estado: string,
  condicion: string,
  direccion: string,
  ubigeo: string,
  via_tipo: string,
  via_nombre: string,
  zona_codigo: string,
  zona_tipo: string,
  numero: string,
  interior: string,
  lote: string,
  dpto: string,
  manzana: string,
  kilometro: string,
  distrito: string,
  provincia: string,
  departamento: string,
  es_agente_retencion: boolean,
  es_buen_contribuyente: boolean,
  locales_anexos: string,
  tipo: string,
  actividad_economica: string,
  numero_trabajadores: string,
  tipo_facturacion: string,
  tipo_contabilidad: string,
  comercio_exterior: string
}

export interface DatosDNI {
  first_name: string,
  first_last_name: string,
  second_last_name: string,
  full_name: string,
  document_number: string
}

export interface Vehiculo {
  id: number,
  placa: string,
  tonelaje: number,
  ejes: number,
  fecha_vigencia_soat: string,
  anio_fabricacion: number
}

export interface Puntos {
  id: number;
  nombre: string;
  direccion: string;
  lat?: number;
  lng?: number;
  ubigeo?: number;
  telefono?: number;
}

export interface Manifiesto {
  id: number;
  conductor_id: number;
  copiloto_id: number;
  codigo_ounto_origen: number;
  codigo_punto_destino: number;
  serie: string;
  numero: string;
  turno: string;
  fecha_traslado: string;
  estado: string;
  arrived_at: string;
  arrived_lat?: number;
  arrived_lng?: number;
}

export interface ManifiestoCreate {
  conductor_id: number;
  copiloto_id: number;
  codigo_ounto_origen?: number;
  codigo_punto_destino?: number;
  serie: string;
  numero: string;
  turno: string;
  fecha_traslado: string;
}

export interface Conductor {
  id: number;
  licencia: string;
  tipo_licencia: string;
  persona_id: number;
  compania_id: number;
  persona: Persona;
}

export interface Envio {
  id: number;
  remitente: number;
  destinatario: number;
  estado_pago: boolean;
  clave_recojo: string;
  peso: number;
  fecha_envio: string;
  fecha_recepcion: string;
  tipo_contenido: boolean;
  manifiesto: number;
  valida_restricciones: boolean;
  punto_origen_id: number;
  punto_destino_id: number;
  estado_entrega: boolean;
  entrega_domicilio: boolean;
  direccion_envio: string;
  ticket_numero: string;
  estado_whatsapp: string;
  estado_envio: string;
  id_tracking: string;
  usuario_crea: string;
  precio_envio?: number;
  placa_vehiculo: string;
  pago_destino?: boolean;
  guia_referencia?: string;
  origen_nombre?: string;
  destino_nombre?: string;
  monto_envio?: number | string;
  monto_pendiente_cobro?: number | string;
  afecta_caja?: boolean;
  es_informativo?: boolean;
  estado_pago_destino?: string;
  usuario_cobrador_id?: number;
  fecha_cobro_destino?: string;
  monto_referencial_envio?: number | string;
  ingreso_real_caja?: number | string;
  ingreso_informativo_no_contable?: number | string;
}

export interface EnvioCreate {
  remitente: number;
  destinatario: number;
  estado_pago: boolean;
  clave_recojo: string;
  peso: number;
  fecha_envio: string;
  /*fecha_recepcion: string;*/
  tipo_contenido: boolean;
  manifiesto: number;
  valida_restricciones: boolean;
  punto_origen_id: number;
  punto_destino_id: number;
  entrega_domicilio: boolean;
  direccion_envio: string;
  ticket_numero: string;
  estado_whatsapp: string;
  estado_envio: string;
  pago_destino?: boolean;
  guia_referencia?: string;
}

export interface Comprobante {
  id: number;
  numero_comprobante: string;
  forma_pago: number;
  precio_total?: number;
  fecha_comprobante: string;
  impuesto?: number;
  serie: string;
  numero:string;
  estado_comprobante: string;
  fecha_pago: string;
  emisor: number;
  cliente: number;
  emisor_ruc: string;
  cliente_documento: string;
  envio_id: number;
  estado_cpe: string;
  tipo_comprobante_sunat: string;
  tipo_operacion: string;
  tipo_moneda: string;
  fecha_emision?: string;
  total_gravadas?: number;
  total_exoneradas?: number;
  total_inafectas?: number;
  total_igv?: number
  total_icbper?: number;
  total_descuentos?: number;
  total_otros_cargos?: number;
  afecto_detraccion: boolean;
  codigo_spot: string;
  porcentaje_det?: number;
  base_det?: number;
  monto_det?: number;
  estado_det: string;
  fecha_deposito_det: string;
  nro_contancia_det: string;
  periodo_det: string;
}

export interface ComprobanteCreate {
  numero_comprobante: string;
  forma_pago: number;
  precio_total: number;
  fecha_comprobante: string;
  impuesto: number;
  serie: string;
  numero:string;
  estado_comprobante: string;
  fecha_pago: string;
  emisor: number;
  cliente: number;
  emisor_ruc: string;
  cliente_documento: string;
  envio_id: number;
  estado_cpe: string;
  tipo_comprobante_sunat: string;
  tipo_operacion: string;
  tipo_moneda: string;
  fecha_emision?: string;
  total_gravadas?: number;
  total_exoneradas?: number;
  total_inafectas?: number;
  total_igv?: number
  total_icbper?: number;
  total_descuentos?: number;
  total_otros_cargos?: number;
  sede_id?: number;
}

export interface ComprobanteDetraccionRead {
  fecha_emision: string;
  serie_numero: string;
  cliente: string;
  envio: number;
  subtotal?: number;
  igv?: number;
  total?: number;
  codigo_spot: string;
  porcentaje_det?: number;
  base_det?: number;
  monto_det?: number;
  estado_det: string;
  fecha_deposito_det: string;
  nro_constancia_det: string;
}

export interface ComprobanteReporteRead {
  id: number;
  envio_id: number;
  numero_comprobante: string;
  serie: string;
  numero: string;
  precio_total: number;
  fecha_comprobante: string;
  estado_comprobante: string;
  usuario_crea: string;
}

export interface DetalleComprobante {
  id: number;
  numero_item: number;
  cantidad: number;
  descripcion: number;
  precio_unitario: number;
  comprobante_id: number;
}

export interface DetalleComprobanteCreate {
  id: number;
  numero_item: number;
  cantidad: number;
  descripcion: number;
  precio_unitario: number;
  valor_unitario: number;
  comprobante_id: number;
}

export interface DetalleEnvio {
  id: number;
  numero_item: number;
  cantidad: number;
  descripcion: number;
  precio_unitario: number;
  envio_id: number;
}

export interface DetalleEnvioCreate {
  id: number;
  numero_item: number;
  cantidad: number;
  descripcion: number;
  precio_unitario: number;
  precio_total: number;
  envio_id: number;
}

export interface General {
  id: number;
  codigo_grupo: string;
  codigo_principal: number;
  nombre: string;
  orden: number;
  es_cabecera: boolean;
  serie: string,
  correlativo: number;
}

export interface GeneralUpdate {
  id: number;
  codigo_grupo: string;
  codigo_principal: number;
  nombre: string;
  orden: number;
  es_cabecera: boolean;
  serie: string,
  correlativo: number;
}


export interface Cabecera {
  id: number;
  tipo_movimiento: string;
  monto: number;
  persona_id: number;
  placa: string;
  autorizado:number;
  manifiesto_id: number;
  sede_id?: number;
  vale_gastos?: string | number;
  vale_gasto?: string | number;
  fecha_movimiento?: string;
}

export interface CabeceraCreate {
  tipo_movimiento: string;
  monto: number;
  persona_id?: number;
  placa?: string;
  autorizado?:number;
  manifiesto_id?: number;
  sede_id?: number;
  vale_gastos?: string | number;
  vale_gasto?: string | number;
  fecha_movimiento?: string;
}

export interface Detalle {
  id: number;
  tipo_comprobante_sunat: string;
  numero_comprobante: string;
  descripcion: string;
  tipo_gasto: number;
  cabecera_id: number;
  monto: number;
}

export interface DetalleFull {
  id: number;
  tipo_comprobante_sunat: string;
  numero_comprobante: string;
  descripcion: string;
  tipo_gasto: number;
  cabecera_id: number;
  monto: number;
  cabecera: Cabecera
}

export interface DetalleCreate {
  tipo_comprobante_sunat: string;
  numero_comprobante: string;
  descripcion: string;
  tipo_gasto?: number;
  cabecera_id: number;
  monto: number;
}

export interface MovimientoDetalleReporteRead {
  id: number;
  tipo_comprobante_sunat: string;
  tipo_movimiento: string;
  numero_comprobante: string;
  descripcion: string;
  tipo_gasto?: number;
  cabecera_id: number;
  monto?: number;
  fecha_creacion: string;
  usuario_crea: string;
}

export interface MessageCreate {
  to: string;
  message: string;
  envio_id: number;
}

export interface DespachoRead {
  id: number;
  estado: string;
  compania_id: number;
  origen_ubigeo: string;
  origen_direccion: string;
  destino_ubigeo: string;
  destino_direccion: string;
  razon_transferencia: string;
  inicio: string;
  aprobado_by: number;
  notas: string;
  manifiesto_id?: number;
  envio_id?: number;
}

export interface DespachoCreate {
  estado: string;
  compania_id: number;
  origen_ubigeo: string;
  origen_direccion: string;
  destino_ubigeo: string;
  destino_direccion: string;
  razon_transferencia: string;
  inicio: string;
  aprobado_by: number;
  notas: string;
  manifiesto_id?: number;
  envio_id?: number;
}

export interface Guia {
  id: number;
  despacho_id: number;
  doc_type: string;
  series: string;
  numero: number;
  numero_completo: string;
  emitido_en: string;
  qr: string;
  pdf_hash: string;
  hash_sha: string;
  anulado: string;
}

export interface GuiaTrama {
  id: number;
  dod_type: string;
  series: string;
  numero: string;
  numero_completo: string;
  emitido_en: string;
  qr: string;
  pdf_hash: string;
  hash_sha: string;
  enviado: string;
}

export interface GuiaCreate {
  despacho_id: number;
  doc_type: string;
  series: string;
  numero: number;
  numero_completo: string;
  emitido_en: string;
}

export interface ItemGuia {
  id: number;
  despacho_id: number;
  sku: string;
  descripcion: string;
  uom: string;
  cantidad: number;
  peso: number;
}

export interface ItemGuiaCreate {
  despacho_id: number;
  sku: string;
  descripcion: string;
  uom: string;
  cantidad: number;
  peso: number;
}

export interface UsuarioSede {
  usuario_id: number;
  punto_id: number;
}

export interface ComprobanteSunat {
  id: number;
  comprobante_id: number;
  ambiente: string;
  hash: string;
  qr: string;
  sunat_cod: string;
  sunat_msg: string;
  ticket: string;
  fecha_envio: string;
  fecha_respuesta: string;
}

export interface Cliente {
  id: number;
  persona_id: number;
  cliente_compania_id: number;
  rol: string;
}

export interface ClienteCreate {
  persona_id: number;
  cliente_compania_id: number;
  rol: string;
}

export interface Rol {
  id: number;
  code: string;
  nombre: string;
}

export interface RolPermiso {
  id: number;
  code: string;
  description: string;
}

export interface SerieComprobante {
  id: number;
  emisor_id: number;
  sede_id: number;
  tipo_comprobante_sunat: string;
  serie: string;
  correlativo: number
}

export interface Resumen {
  comprobante: string;
  remitente: string;
  destinatario: string;
  fecha_envio: string;
  fecha_entrega: string;
  pagado: boolean;
  dias_desde_entrega: number;
  monto: number;
}

export interface ManifiestoResumen {
  manifiesto: string;
  conductor: string;
  numero_envios: number;
  peso_total: number;
  ingresos_generados: number;
  ingreso_promedio: number;
}

export interface PublicLinkRequest {
  conductor_id: number;
  expires_minutes: number;
}

export interface PublicLinkResponse {
  url: string;
  token: string;
  expires_at: string;
}

export interface EnvioTrackingPublicLinkRequest {
  envio_id?: number;
  ticket_numero?: string;
  expires_minutes?: number;
}

export interface EnvioTrackingPublicRead {
  envio_id: number;
  ticket_numero?: string;
  estado_envio?: string;
  estado_entrega?: boolean;
  fecha_envio?: string;
  fecha_recepcion?: string | null;
  entrega_domicilio?: boolean;
  direccion_envio?: string;
  punto_origen_id?: number | null;
  punto_destino_id?: number | null;
  origen_nombre?: string | null;
  destino_nombre?: string | null;
}

export interface EnvioWithDetalleRead extends Partial<Envio> {
  detalles: DetalleEnvio[];
  origen_nombre: string
  destino_nombre: string
}

export interface EnvioListRead extends Partial<Envio> {
  usuario_crea: string;
}

export interface ManifiestoWithEnviosRead {
  id: number;
  estado: string;
  piloto_nombre: string;
  copiloto_nombre: string;
  origen_nombre: string;
  destino_nombre: string;
  envios: EnvioWithDetalleRead[];
}

export interface ManifiestoArrivedUpdate {
  estado: string;
  arrived_at: string;
  arrived_lat: number;
  arrived_lng: number;
  arrived_accuracy_m?: number;
  arrived_note: string;
}

export interface GuiaTramaFinal {
  envio_id: number;
  guia: GuiaTrama;
  despacho: DespachoRead;
  envio: Envio;
  remitente: PersonaTrama;
  destinatario: PersonaTrama;
  origen: Puntos;
  destino: Puntos;
  manifiesto: Manifiesto;
  conductor: Conductor;
  vehiculo: Vehiculo;
  items: DetalleEnvio[];
}

export interface GuiaSunatRead {
  id: number;
  guia_id: number;
  ambiente: string;
  hash: string;
  qr: string;
  sunat_cod: string;
  sunat_msg: string;
  ticket: string;
  fecha_envio: string;
  fecha_respuesta: string;
}

export interface EnvioReporteRead extends Envio {
  usuario_crea: string;
  origen_nombre: string;
  destino_nombre: string;
  monto_envio?: number;
  monto_pendiente_cobro?: number;
  afecta_caja?: boolean;
  es_informativo?: boolean;
  estado_pago_destino: string;
  usuario_cobrador_id?: number;
  fecha_cobro_destino?: string;
  monto_referencial_envio?: number;
  ingreso_real_caja?: number;
  ingreso_informativo_no_contable?: number;
}

export interface EnvioReporteRelacionesRead {
  envio: EnvioReporteRead;
  comprobantes: ComprobanteReporteRead[];
  movimientos: MovimientoDetalleReporteRead[];
}

export interface EnviosDiariosAgrupadosRead {
  fecha_creacion: string;
  usuario_crea: string;
  usuario_punto_id?: number;
  usuario_punto_nombre: string;
  total_envios: number;
  envios: EnvioReporteRelacionesRead[]
}

export interface EnviosDiariosResumenPorUsuarioRead {
  fecha_creacion: string;
  usuario_crea: string;
  usuario_punto_id?: number;
  usuario_punto_nombre: string;
  total_envios: number;
  total_comprobantes: number;
  total_movimientos: number;
  total_monto_comprobantes: number;
  total_monto_movimientos: number;
  total_monto_ingresos?: number;
  total_monto_egresos?: number;
  total_monto_envios?: number;
  total_monto_por_cobrar_destino?: number;
  total_monto_cobrado?: number;
  total_ingresos_reales?: number;
  total_egresos_reales?: number;
  neto_caja_real?: number;
  monto_envios_pago_destino_informativo?: number;
  monto_envios_pago_destino_cobrados?: number;
  ingreso_real_caja?: number;
  ingreso_informativo_no_contable?: number;
  total_comprobantes_emitidos_usuario?: number;
  total_monto_comprobantes_emitidos_usuario?: number;
  total_envios_terceros_con_comprobante_emitido_usuario?: number;
}

export interface ManifiestoGuiaSunatEstadoRead {
  guia_id: number;
  despacho_id: number;
  envio_id?: number;
  numero_guia: string;
  ambiente: string;
  sunat_cod: string;
  sunat_msg: string;
  ticket: string;
  estado: string;
  fecha_envio: string;
  fecha_respuesta: string;
}

export interface ManifiestoEnvioPendienteGuiaRead {
  envio_id: number;
  despacho_id?: number;
  ticket_numero: string;
  fecha_envio: string;
  punto_origen_id?: number;
  punto_destino_id?: number;
  origen_nombre: string;
  destino_nombre: string;
  motivo: string;
}

export interface ManifiestoGuiasSunatResumenRead {
  manifiesto_id: number;
  total_envios: number;
  total_despachos: number;
  total_guias: number;
  total_guias_emitidas: number;
  total_envios_pendientes_guia: number;
  total_guias_no_emitidas: number;
  estados: Record<string, number>;
  guias_emitidas: ManifiestoGuiaSunatEstadoRead[];
  guias_no_emitidas: ManifiestoGuiaSunatEstadoRead[];
  envios_pendientes_guia: ManifiestoEnvioPendienteGuiaRead[];
}


export interface CompaniaConfigRead {
  id: number;
  compania_id: number;
  lema: string;
  consideraciones: string;
  condiciones: string;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////// BI Interfaces /////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface BIResumenResponse {
  empresa_id: number; // cia_id
  sede_id: number; // punto_id
  fecha_desde: string;
  fecha_hasta: string;
  total_envios: number;
  monto_total_envios: number;
  monto_total_cobrado: number;
  monto_total_por_cobrar: number;
  total_clientes: number;
  ingresos_netos: number;
  total_conductores: number;
  total_manifiestos: number;
  total_envios_entregados: number;
}

export interface BIEnviosPorDiaItem {
  fecha: string;
  total_envios: number;
  total_envios_cobrados: number;
  total_envios_por_cobrar: number;
  monto_total_envios: number;
  monto_total_cobrado: number;
  monto_total_por_cobrar: number;
}

export interface BIClienteTopItem {
  cliente_id: number;
  total_comprobantes: number;
  monto_total: number;
  monto_neto: number;
  ticket_promedio: number;
}

export interface BIConductorRankingItem {
  conductor_id: number;
  total_manifiestos: number;
  total_envios: number;
  total_envios_entregados: number;
  peso_total: number;
  monto_total_envios: number;
}

export interface BIDashboardKpisResponse {
  empresa_id: number;
  sede_id?: number | null;
  fecha_desde: string;
  fecha_hasta: string;
  total_envios: number;
  envios_finalizados: number;
  envios_pendientes: number;
  envios_incidencia: number;
  cumplimiento_pct: number;
  costo_total: number;
  ingreso_total: number;
  ticket_promedio: number;
}

export interface BIDashboardTrendPoint {
  fecha: string;
  total_envios: number;
}

export interface BIDashboardDistribucionItem {
  sede_id: number;
  sede_nombre: string;
  total_envios: number;
}

export interface BIDashboardRutaFinanzasItem {
  ruta_id?: number | null;
  ruta_nombre: string;
  costo_total: number;
  ingreso_total: number;
}

export interface BIDashboardTransporteItem {
  unidad_id?: number | null;
  unidad_label: string;
  conductor_id?: number | null;
  conductor_nombre?: string | null;
  total_envios: number;
}

export interface BIDashboardTopClienteItem {
  cliente_id: number;
  cliente_nombre?: string | null;
  total_envios: number;
  monto_total: number;
}

export interface BIDashboardTopRutaItem {
  ruta_id?: number | null;
  ruta_nombre: string;
  total_envios: number;
  monto_total: number;
}

export interface BIDashboardAlertaItem {
  tipo: string;
  severidad: 'alta' | 'media' | 'baja';
  total: number;
  detalle?: string | null;
}


export interface ResumenSedeDetalleRead {
  fecha_creacion: string;
  sede_id: number;
  sede_nombre: string;
  total_envios: number;
  total_comprobantes: number;
  total_movimientos_sin_comprobante: number;
  total_monto_comprobantes?: number;
  total_monto_movimientos_sin_comprobante?: number;
  total_monto_envios_pago_destino?: number;
  envios: EnvioReporteRead[] | [];
  comprobantes: ComprobanteReporteRead[] | [];
  movimientos_sin_comprobante: MovimientoDetalleReporteRead[] | []
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////// Printing mode ///////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface PrintPayloadOptions {
  paper_width?: number;
  cut: boolean | true;
  open_drawer: boolean | false;
  preview_only: boolean | false;
}

export interface PrintPayloadMetadata {
  requested_by: string;
  document_id: number;
  document_type: DocumentType
  shipment_id?: number;
  invoice_id?: number;
  guide_id?: number;
  settlement_id?: number;
  station_id?: number;
  tenant_id: string;
  extras: Record<string, any>;
}

export enum DocumentType {
  TICKET = 'ticket',
  LABEL = 'label',
  AFFIDAVIT = 'affidavit',
  INVOICE = 'invoice',
  GUIDE = 'guide',
  SETTLEMENT = 'settlement'
}

export enum OutputMode {
  THERMAL = "thermal",
  PDF = "pdf",
  SYSTEM = "system",
  PREVIEW = "preview"
}

// payload para impresión desde el printer agent
export interface PrintPayloadResponse {
  tenant_id: string;
  station_id: string;
  document_type: DocumentType
  template_code: string;
  output_mode: OutputMode
  printer_target: string;
  copies: number;
  data: Record<string, any>;
  options: PrintPayloadOptions;
  metadata: PrintPayloadMetadata;
}
