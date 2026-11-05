import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { WishlistService } from './services/wishlist-service';
import { BuyNowService } from './services/buy-now-service';
import { HttpClient } from '@angular/common/http';
import { EMPTY, catchError, filter, interval, startWith, switchMap } from 'rxjs';

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
    private readonly http: HttpClient,
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

    // Detect an account blocked from another admin session while this client stays open.
    this.subs.add(interval(15000).pipe(
      startWith(0),
      filter(() => !!(localStorage.getItem('token') || sessionStorage.getItem('token'))),
      switchMap(() => this.http.get('http://localhost:3002/api/users/me').pipe(catchError(() => EMPTY))),
    ).subscribe());
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
