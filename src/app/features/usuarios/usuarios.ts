import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Users } from '../../../../core/services/users';
import { Usuario } from '../../../../core/mapped';

@Component({
  selector: 'feature-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})
export class UsuariosFeature implements OnInit {
  private readonly user = inject(Users);

  lista_usuarios: Usuario[] = [];
  loading = false;
  error: string | null = null;

  // Filtros y paginación
  search = '';
  status: 'all' | 'active' | 'inactive' = 'all';
  page = 1;
  pageSize = 8;

  // Modal
  showModal = false;
  newUser = { email: '', is_active: true } as { email: string; is_active: boolean };

  get filteredUsuarios(): Usuario[] {
    const term = this.search.trim().toLowerCase();
    return (this.lista_usuarios || []).filter((u) => {
      const okTerm = !term || (u.email || '').toLowerCase().includes(term);
      const okStatus =
        this.status === 'all' ||
        (this.status === 'active' && (u as any).is_active) ||
        (this.status === 'inactive' && !(u as any).is_active);
      return okTerm && okStatus;
    });
  }

  get total(): number {
    return this.filteredUsuarios.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get pageItems(): Usuario[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredUsuarios.slice(start, start + this.pageSize);
  }

  get pageStart(): number {
    return this.total ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get pageEnd(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }

  setPage(n: number) {
    this.page = Math.min(Math.max(1, n), this.totalPages);
  }

  onFilterChange() {
    this.page = 1;
  }

  openModal() {
    this.newUser = { email: '', is_active: true };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  submitNewUser() {
    // UI-only: agrega al listado local. Conéctalo al backend cuando esté disponible.
    if (!this.newUser.email) return;
    const exists = this.lista_usuarios.some((u) => (u.email || '').toLowerCase() === this.newUser.email.toLowerCase());
    if (!exists) {
      this.lista_usuarios = [
        { ...(this.newUser as any) } as unknown as Usuario,
        ...this.lista_usuarios,
      ];
      this.onFilterChange();
    }
    this.closeModal();
  }

  loadUsuarios() {
    this.loading = true;
    this.error = null;
    this.user.getUsuarios().subscribe({
      next: (response) => {
        this.lista_usuarios = response || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudieron cargar los usuarios';
      },
    });
  }

  ngOnInit(): void {
    this.loadUsuarios();
  }
}

