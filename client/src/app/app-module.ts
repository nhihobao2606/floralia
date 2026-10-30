import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { LOCALE_ID, NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { Header } from './components/header/header';
import { Header2 } from './components/header2/header2';
import { Footer } from './components/footer/footer';
import { Homepage } from './pages/homepage/homepage';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { Profile } from './pages/profile/profile';
import { Addresses } from './pages/addresses/addresses';
import { ProductListComponent } from './product-list/product-list';
import { ProductDetail } from './product-detail/product-detail';

registerLocaleData(localeVi);
import { BlogComponent } from './pages/blog/blog';
import { BlogDetailComponent } from './pages/blog-detail/blog-detail';
import { PromotionsComponent } from './pages/promotions/promotions';
import { Profile } from './profile/profile';

@NgModule({
  declarations: [App, Header, Header2, Footer, Homepage, Login, Signup, Profile, Addresses, ProductListComponent, ProductDetail, BlogComponent, BlogDetailComponent, PromotionsComponent],
  imports: [BrowserModule, AppRoutingModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  providers: [provideBrowserGlobalErrorListeners(), { provide: LOCALE_ID, useValue: 'vi' }],
  bootstrap: [App],
})
export class AppModule {}
