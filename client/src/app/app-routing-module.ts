import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Homepage } from './pages/homepage/homepage';
<<<<<<< HEAD
import { Login } from './login/login';
import { ProductListComponent } from './product-list/product-list';
=======
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { Profile } from './profile/profile';
>>>>>>> 14d2353e806f0b4845fab4993fc1ca6a9e2f66ac

const routes: Routes = [
  {path: '', component: Homepage, pathMatch: 'full'},
  {path: 'home', component: Homepage},
  {path: 'login', component: Login},
<<<<<<< HEAD
  { path: 'products', component: ProductListComponent },
  // Route chi tiết sản phẩm qua Slug
 
=======
  {path: 'signup', component: Signup},
  {path: 'profile', component: Profile},
>>>>>>> 14d2353e806f0b4845fab4993fc1ca6a9e2f66ac
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
