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
}

export interface Usuario {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  password_hash: string;
  person_id: number | null;
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
}

export interface Comprobante {
  id: number;
  tipo_comprobante: number;
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
}

export interface ComprobanteCreate {
  tipo_comprobante: number;
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
  tipo_comprobante: number;
  numero_comprobante: string;
  descripcion: string;
  tipo_gasto: number;
  cabecera_id: number;
  monto: number;
}

export interface DetalleFull {
  id: number;
  tipo_comprobante: number;
  numero_comprobante: string;
  descripcion: string;
  tipo_gasto: number;
  cabecera_id: number;
  monto: number;
  cabecera: Cabecera
}

export interface DetalleCreate {
  tipo_comprobante: number;
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
