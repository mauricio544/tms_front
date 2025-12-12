import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import {General, MessageCreate} from '../mapped';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class Message {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly message: MessageCreate[] = [];
  private readonly auth = inject(AuthService);

  sendMessage(body: MessageCreate): Observable<any> {
    return this.api.post('/utils/whatsapp/send', body);
  }
}
