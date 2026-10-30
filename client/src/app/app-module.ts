import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { LOCALE_ID, NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { Header } from './components/header/header';
import { Footer } from './components/footer/footer';
import { Homepage } from './pages/homepage/homepage';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { Profile } from './profile/profile';
import { ProductListComponent } from './product-list/product-list';
import { ProductDetail } from './product-detail/product-detail';

registerLocaleData(localeVi);

@NgModule({
  declarations: [
    App,
    Header,
    Footer,
    Homepage,
    Login,
    Signup,
    Profile,
    ProductListComponent,
    ProductDetail,
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  providers: [provideBrowserGlobalErrorListeners(), { provide: LOCALE_ID, useValue: 'vi' }],
  bootstrap: [App],
})
export class AppModule {}
