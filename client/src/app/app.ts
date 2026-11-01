import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WishlistService } from './services/wishlist-service';
import { BuyNowService } from './services/buy-now-service';

@Component({
  selector: 'app-root',
  standalone: false,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('client');
  isLoggedIn = false;
  private subs = new Subscription();

  constructor(
    private router: Router,
    readonly wishlistService: WishlistService,
    readonly buyNowService: BuyNowService,
  ) {}

  ngOnInit(): void {
    this.checkAuth();

    this.subs.add(
      this.router.events.subscribe((e) => {
        if (e instanceof NavigationEnd) {
          this.checkAuth();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  @HostListener('window:storage')
  @HostListener('window:cart-updated')
  @HostListener('window:auth-changed')
  checkAuth(): void {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    this.isLoggedIn = !!raw;
  }
}
