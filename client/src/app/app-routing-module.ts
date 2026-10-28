import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Homepage } from './pages/homepage/homepage';
import { Login } from './login/login';
import { ProductListComponent } from './product-list/product-list';

const routes: Routes = [
  {path: '', component: Homepage, pathMatch: 'full'},
  {path: 'home', component: Homepage},
  {path: 'login', component: Login},
  { path: 'products', component: ProductListComponent },
  // Route chi tiết sản phẩm qua Slug
 
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
