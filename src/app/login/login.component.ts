import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UsuarioMe } from '../../../core/mapped';
import {empty} from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: 'login.component.html'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  usuario_me: UsuarioMe | null = null;
  loading = false;
  error: string | null = null;

  form = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [true],
  });

  onSubmit() {
    if (this.form.invalid) return;

    const { username, password, remember } = this.form.value as {
      username: string;
      password: string;
      remember: boolean;
    };

    this.loading = true;
    this.error = null;

    this.auth
      .login({ username, password }, remember)
      .subscribe({
        next: () => {
          this.loading = false;
          this.auth.me().subscribe({
            next: (response) => {
              this.usuario_me = response;
              localStorage.setItem('me', JSON.stringify(this.usuario_me));
              localStorage.setItem('cia', this.usuario_me.companies[0].nombre);
              localStorage.setItem('cia_id', this.usuario_me.companies[0].id.toString());
              localStorage.setItem('ruc', this.usuario_me?.companies[0].ruc);
              console.log(this.usuario_me);
            },
            error: (err) => {

            }
          });
          // Ajusta la ruta de destino según tu app
          this.router.navigateByUrl('dashboard');
        },
        error: (err) => {
          this.loading = false;
          const message = err?.error?.detail || err?.error?.message || 'Credenciales inválidas';
          this.error = typeof message === 'string' ? message : 'Error al iniciar sesión';
        },
      });
  }
}

