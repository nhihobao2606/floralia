import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Homepage } from './pages/homepage/homepage';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { BlogComponent } from './pages/blog/blog';
import { BlogDetailComponent } from './pages/blog-detail/blog-detail';
import { PromotionsComponent } from './pages/promotions/promotions';
import { Profile } from './profile/profile';

const routes: Routes = [
  { path: '', component: Homepage, pathMatch: 'full' },
  { path: 'home', component: Homepage },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'blog', component: BlogComponent },
  { path: 'blog/:slug', component: BlogDetailComponent },
  { path: 'sales', component: PromotionsComponent },
  { path: 'products', redirectTo: 'sales', pathMatch: 'full' },
  { path: 'products/:id', redirectTo: 'sales', pathMatch: 'full' },
  { path: 'account', component: Profile },
  { path: 'profile', redirectTo: 'account', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
