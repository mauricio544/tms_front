import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from "../../src/environments/environment.development";
// import { environment } from "../../src/environments/environment"
import {Observable} from 'rxjs';


@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  get<T>(url: string, params?: Record<string, any>) {
    let httpParams = new HttpParams();
    if(params){
      Object.keys(params).forEach(key=>{
        const value = params[key];
        if (value !== null && value !== undefined && value !== '') {
          httpParams = httpParams.set(key, value);
        }
      })
    }
    return this.http.get<T>(`${this.baseUrl}${url}`, { params: httpParams, observe: 'body' as const });
  }

  post<T>(url: string, body?: unknown) {
    return this.http.post<T>(`${this.baseUrl}${url}`, body, { observe: 'body' as const });
  }

  put<T>(url: string, body: unknown) {
    return this.http.put<T>(`${this.baseUrl}${url}`, body, { observe: 'body' as const });
  }

  patch<T>(url: string, body: unknown){
    return this.http.patch<T>(`${this.baseUrl}${url}`, body, { observe: 'body' as const });
  }

  delete<T>(url: string) {
    return this.http.delete<T>(`${this.baseUrl}${url}`, { observe: 'body' as const });
  }

  getService<T>(url: string) {
    return this.http.get<T>(`${url}`, { observe: 'body' as const });
  }
}
