import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
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
import { Orders } from './pages/orders/orders';
import { OrderDetail } from './pages/order-detail/order-detail';
import { OrderSuccess } from './pages/order-success/order-success';

@NgModule({
  declarations: [
    App,
    Header,
    Header2,
    Footer,
    Homepage,
    Login,
    Signup,
    Profile,
    Addresses,
    Orders,
    OrderDetail,
    OrderSuccess,
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
