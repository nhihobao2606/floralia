import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { LOCALE_ID, NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { Header } from './components/header/header';
import { Header2 } from './components/header2/header2';
import { Footer } from './components/footer/footer';
import { Breadcrumb } from './components/breadcrumb/breadcrumb';
import { Homepage } from './pages/homepage/homepage';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { Profile } from './pages/profile/profile';
import { Addresses } from './pages/addresses/addresses';
import { ProductListComponent } from './pages/product-list/product-list';
import { ProductDetail } from './pages/product-detail/product-detail';
import { BlogComponent } from './pages/blog/blog';
import { BlogDetailComponent } from './pages/blog-detail/blog-detail';
import { PromotionsComponent } from './pages/promotions/promotions';
import { CartComponent } from './pages/cart/cart';
import { CheckoutComponent } from './pages/checkout/checkout';
import { Orders } from './pages/orders/orders';
import { OrderDetail } from './pages/order-detail/order-detail';
import { OrderSuccess } from './pages/order-success/order-success';
import { About } from './pages/about/about';
import { SupportPage } from './pages/support/support-page';
import { ContactPage } from './pages/contact/contact-page';
import { MixTeaPage } from './pages/mix-tea/mix-tea-page';
import { WishlistPage } from './pages/wishlist/wishlist-page';
import { LogoutConfirmation } from './components/logout-confirmation/logout-confirmation';
import { Pagenotfound } from './pages/pagenotfound/pagenotfound';
import { PasswordRecovery } from './pages/password-recovery/password-recovery';
import { GuestOrderTracking } from './pages/guest-order-tracking/guest-order-tracking';
import { GuestOrderDetail } from './pages/guest-order-detail/guest-order-detail';
import { OrderReorderDialog } from './components/order-reorder-dialog/order-reorder-dialog';
import { AuthSessionInterceptor } from './services/auth-session.interceptor';
import { VietnameseDongPipe } from './shared/vnd-format';

registerLocaleData(localeVi);

@NgModule({
  declarations: [
    App,
    Header,
    Header2,
    Footer,
    Breadcrumb,
    Homepage,
    Login,
    Signup,
    Profile,
    Addresses,
    ProductListComponent,
    ProductDetail,
    BlogComponent,
    BlogDetailComponent,
    PromotionsComponent,
    CartComponent,
    CheckoutComponent,
    Orders,
    OrderDetail,
    OrderSuccess,
    GuestOrderTracking,
    GuestOrderDetail,
    About,
    SupportPage,
    ContactPage,
    MixTeaPage,
    WishlistPage,
    LogoutConfirmation,
    OrderReorderDialog,
    Pagenotfound,
    VietnameseDongPipe,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    PasswordRecovery,
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'vi' },
    { provide: HTTP_INTERCEPTORS, useClass: AuthSessionInterceptor, multi: true },
  ],
  bootstrap: [App],
})
export class AppModule {}
