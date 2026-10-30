import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Homepage } from './pages/homepage/homepage';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { Profile } from './pages/profile/profile';
import { Addresses } from './pages/addresses/addresses';
import { ProductListComponent } from './product-list/product-list';
import { ProductDetail } from './product-detail/product-detail';
import { BlogComponent } from './pages/blog/blog';
import { BlogDetailComponent } from './pages/blog-detail/blog-detail';
import { PromotionsComponent } from './pages/promotions/promotions';

const routes: Routes = [
  {path: '', component: Homepage, pathMatch: 'full'},
  {path: 'home', component: Homepage},
  {path: 'login', component: Login},
  {path: 'signup', component: Signup},
  {path: 'account', component: Profile},
  {path: 'addresses', component: Addresses},
  {path: 'products', component: ProductListComponent},
  {path: 'product/:slug', component: ProductDetail},
  { path: 'blog', component: BlogComponent },
  { path: 'blog/:slug', component: BlogDetailComponent },
  { path: 'sales', component: PromotionsComponent },
  { path: 'profile', redirectTo: 'account', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
