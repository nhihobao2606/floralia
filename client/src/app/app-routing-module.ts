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
import { About } from './pages/about/about';
import { SupportPage } from './pages/support/support-page';
import { ContactPage } from './pages/contact/contact-page';
import { MixTeaPage } from './pages/mix-tea/mix-tea-page';
import { WishlistPage } from './pages/wishlist/wishlist-page';

const routes: Routes = [
  {path: '', component: Homepage, pathMatch: 'full'},
  {path: 'home', component: Homepage},
  {path: 'about', component: About},
  {path: 'gioi-thieu', component: About},
  {path: 'return-policy', component: SupportPage, data: { supportPage: 'returns' }},
  {path: 'privacy', component: SupportPage, data: { supportPage: 'privacy' }},
  {path: 'terms', component: SupportPage, data: { supportPage: 'terms' }},
  {path: 'faq', component: SupportPage, data: { supportPage: 'faq' }},
  {path: 'contact', component: ContactPage},
  {path: 'mix-tra', component: MixTeaPage},
  {path: 'wishlist', component: WishlistPage},
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
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
