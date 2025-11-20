export interface Company {
  id: number;
  nombre: string;
  tipo: string,
  is_default: boolean
}

export interface UsuarioMe {
  id: number;
  email: string;
  is_active: boolean;
  person_id: number | null;
  permissions: string[];
  companies: Company[];
}

export interface Usuario {
  id: number;
  email: string;
  is_active: boolean;
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
  codigo_ounto_origen: number;
  codigo_punto_destino: number;
  serie: string;
  numero:string;
}
