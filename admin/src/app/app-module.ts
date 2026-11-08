import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { AdminLogin } from './pages/admin-login/admin-login';
import { Articles } from './pages/articles_manage/articles/articles';
import { ArticleEditor } from './pages/articles_manage/article-editor/article-editor';
import { Orders } from './pages/orders_manage/orders/orders';
import { OrderDetail } from './pages/orders_manage/order-detail/order-detail';
import { Pagenotfound } from './pages/pagenotfound/pagenotfound';
import { ProductManage } from './pages/product-manage/product-manage';
import { Products } from './pages/product-manage/products/products';
import { ProductEditor } from './pages/product-manage/product-editor/product-editor';
import { Categories } from './pages/category-manage/categories/categories';
import { CategoryEditor } from './pages/category-manage/category-editor/category-editor';
import { FormsModule } from '@angular/forms';
import { AdminSidebar } from './components/admin-sidebar/admin-sidebar';
import { CustomSelect } from './components/custom-select/custom-select';
import { AdminOrders } from './pages/orders_manage/orders/orders';
import { AdminOrderDetail } from './pages/orders_manage/order-detail/order-detail';
import { AdminUsers } from './pages/users_manage/users/users';
import { AdminUserDetail } from './pages/users_manage/user-detail/user-detail';
import { AdminUserForm } from './pages/users_manage/user-form/user-form';
import { ApiOriginInterceptor } from './services/api-origin.interceptor';

@NgModule({
  declarations: [App, Pagenotfound, ProductManage, Products, ProductEditor, Categories, CategoryEditor],
  imports: [
    BrowserModule,
    AppRoutingModule,
    RouterOutlet,
    HttpClientModule,
    AdminLogin,
    Articles,
    ArticleEditor,
    FormsModule,
    AdminSidebar,
    CustomSelect,
    AdminOrders,
    AdminOrderDetail,
    AdminUsers,
    AdminUserDetail,
    AdminUserForm,
    Orders,
    OrderDetail,
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: HTTP_INTERCEPTORS, useClass: ApiOriginInterceptor, multi: true },
  ],
  bootstrap: [App],
})
export class AppModule {}
