import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly storedIds = signal<ReadonlySet<string>>(new Set(this.readStoredIds()));
  readonly ids = this.storedIds.asReadonly();
  readonly toastMessage = signal('');
  readonly loginPromptVisible = signal(false);
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('wishlist-updated', this.syncFromStorage);
      window.addEventListener('storage', this.syncFromStorage);
    }
  }

  isSaved(product: unknown): boolean {
    if (!this.isAuthenticated()) return false;
    const saved = this.ids();
    return this.getProductKeys(product).some((key) => saved.has(key));
  }

  toggle(product: unknown): boolean {
    if (!this.isAuthenticated()) {
      this.promptLogin();
      return false;
    }

    const keys = this.getProductKeys(product);
    if (!keys.length) return false;

    const next = new Set(this.ids());
    const isCurrentlySaved = keys.some((key) => next.has(key));
    if (isCurrentlySaved) keys.forEach((key) => next.delete(key));
    else keys.forEach((key) => next.add(key));

    this.save(next);
    const added = !isCurrentlySaved;
    if (added) this.showAddedToast();
    return added;
  }

  remove(product: unknown): void {
    if (!this.isAuthenticated()) return;
    const keys = this.getProductKeys(product);
    const next = new Set(this.ids());
    keys.forEach((key) => next.delete(key));
    this.save(next);
  }

  isAuthenticated(): boolean {
    return Boolean(
      this.getStorage()?.getItem('currentUser') ||
      this.getSessionStorage()?.getItem('currentUser')
    );
  }

  promptLogin(): void {
    this.loginPromptVisible.set(true);
  }

  closeLoginPrompt(): void {
    this.loginPromptVisible.set(false);
  }

  private showAddedToast(): void {
    this.toastMessage.set('Đã thêm sản phẩm vào danh sách yêu thích.');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3200);
  }

  private readonly syncFromStorage = (): void => {
    this.storedIds.set(new Set(this.readStoredIds()));
  };

  private save(ids: Set<string>): void {
    this.storedIds.set(ids);
    try {
      this.getStorage()?.setItem('wishlist', JSON.stringify([...ids]));
    } catch {
      // Keep the current page usable when browser storage is unavailable.
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('wishlist-updated'));
    }
  }

  private readStoredIds(): string[] {
    try {
      const value: unknown = JSON.parse(this.getStorage()?.getItem('wishlist') || '[]');
      return Array.isArray(value)
        ? value.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [];
    } catch {
      return [];
    }
  }

  private getStorage(): Storage | null {
    try {
      return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
    } catch {
      return null;
    }
  }

  private getSessionStorage(): Storage | null {
    try {
      return typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
    } catch {
      return null;
    }
  }

  private getProductKeys(product: unknown): string[] {
    if (!product || typeof product !== 'object') return [];
    const item = product as Record<string, unknown>;
    return [...new Set([item['_id'], item['id'], item['productId'], item['sku'], item['slug']]
      .filter((key): key is string | number => typeof key === 'string' || typeof key === 'number')
      .map(String)
      .filter(Boolean))];
  }
}
