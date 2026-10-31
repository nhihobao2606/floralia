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

const routes: Routes = [
  { path: '', component: Homepage, pathMatch: 'full' },
  { path: 'home', component: Homepage },

  // Giới thiệu & Hỗ trợ & Liên hệ
  { path: 'about', component: About },
  { path: 'gioi-thieu', component: About },
  { path: 'return-policy', component: SupportPage, data: { supportPage: 'returns' } },
  { path: 'privacy', component: SupportPage, data: { supportPage: 'privacy' } },
  { path: 'terms', component: SupportPage, data: { supportPage: 'terms' } },
  { path: 'faq', component: SupportPage, data: { supportPage: 'faq' } },
  { path: 'contact', component: ContactPage },
  { path: 'mix-tra', component: MixTeaPage },
  { path: 'wishlist', component: WishlistPage },

  // Tài khoản & Xác thực
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'account', component: Profile },
  { path: 'profile', redirectTo: 'account', pathMatch: 'full' },
  { path: 'addresses', component: Addresses },

  // Sản phẩm & Chi tiết sản phẩm
  { path: 'products', component: ProductListComponent },
  { path: 'product/:slug', component: ProductDetail },
  { path: 'products/:slug', component: ProductDetail },

  // Blog & Khuyến mãi
  { path: 'blog', component: BlogComponent },
  { path: 'blog/:slug', component: BlogDetailComponent },
  { path: 'sales', component: PromotionsComponent },

  // Giỏ hàng & Thanh toán
  { path: 'cart', component: CartComponent },
  { path: 'checkout', component: CheckoutComponent },

  // Đơn hàng của tôi, Chi tiết đơn hàng & Đặt hàng thành công
  { path: 'orders', component: Orders },
  { path: 'orders/:id', component: OrderDetail },
  { path: 'order-history', component: Orders },
  { path: 'order-detail/:id', component: OrderDetail },
  { path: 'order-success', component: OrderSuccess },
  { path: 'order-success/:id', component: OrderSuccess },

  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
