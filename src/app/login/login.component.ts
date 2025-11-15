import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

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

  loading = false;
  error: string | null = null;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [true],
  });

  onSubmit() {
    if (this.form.invalid) return;

    const { email, password, remember } = this.form.value as {
      email: string;
      password: string;
      remember: boolean;
    };

    this.loading = true;
    this.error = null;

    this.auth
      .login({ email, password }, remember)
      .subscribe({
        next: () => {
          this.loading = false;
          this.auth.me().subscribe({
            next: (response) => {
              console.log(response);
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
