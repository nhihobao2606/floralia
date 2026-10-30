import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Homepage } from './pages/homepage/homepage';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { Profile } from './pages/profile/profile';
import { Addresses } from './pages/addresses/addresses';
import { Orders } from './pages/orders/orders';
import { OrderDetail } from './pages/order-detail/order-detail';
import { OrderSuccess } from './pages/order-success/order-success';

const routes: Routes = [
  { path: '', component: Homepage, pathMatch: 'full' },
  { path: 'home', component: Homepage },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'account', component: Profile },
  { path: 'addresses', component: Addresses },
  { path: 'orders', component: Orders },
  { path: 'orders/:id', component: OrderDetail },
  { path: 'order-history', component: Orders },
  { path: 'order-detail/:id', component: OrderDetail },
  { path: 'order-success', component: OrderSuccess },
  { path: 'order-success/:id', component: OrderSuccess },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
