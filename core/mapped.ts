export interface Company {
  id: number;
  nombre: string;
  tipo: string,
  is_default: boolean;
  ruc: string;
}

export interface UsuarioMe {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  person_id: number | null;
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
}

export interface CabeceraCreate {
  tipo_movimiento: string;
  monto: number;
  persona_id?: number;
  placa?: string;
  autorizado?:number;
  manifiesto_id?: number;
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
  expres_at: string;
}

export interface EnvioWithDetalleRead extends Partial<Envio> {
  detalles: DetalleEnvio[];
  origen_nombre: string
  destino_nombre: string
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
