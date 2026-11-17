import { Component, Input } from '@angular/core';

export interface BreadcrumbItem {
  label: string;
  route?: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: false,
  template: `
    <nav class="site-breadcrumb" aria-label="Điều hướng">
      <ol>
        <li *ngFor="let item of items; let last = last">
          <a *ngIf="item.route && !last" [routerLink]="item.route">{{ item.label }}</a>
          <span *ngIf="!item.route || last" [attr.aria-current]="last ? 'page' : null">{{ item.label }}</span>
          <i *ngIf="!last" class="bi bi-chevron-right" aria-hidden="true"></i>
        </li>
      </ol>
    </nav>
  `,
  styles: [`
    :host { display: block; background: #f1f6ec; border-bottom: 1px solid rgba(29, 83, 56, .08); }
    .site-breadcrumb { width: min(1240px, 100%); margin: 0 auto; padding: 10px 24px; color: #6b7f72; font: 400 13px/1.5 'Roboto', sans-serif; }
    ol { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; margin: 0; padding: 0; list-style: none; }
    li { display: inline-flex; align-items: center; gap: 9px; min-width: 0; }
    a { color: #526b5d; text-decoration: none; transition: color .2s ease; }
    a:hover { color: #1d5338; }
    i { color: #aab8ac; font-size: 10px; }
    [aria-current="page"] { color: #1d5338; font-weight: 500; }
    @media (max-width: 575px) { .site-breadcrumb { padding: 11px 16px; font-size: 12px; } ol, li { gap: 7px; } }
  `],
})
export class Breadcrumb {
  @Input() items: BreadcrumbItem[] = [];
}
