import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { AdminLogin } from './pages/admin-login/admin-login';
import { Articles } from './pages/articles_manage/articles/articles';
import { ArticleEditor } from './pages/articles_manage/article-editor/article-editor';
import { Orders } from './pages/orders_manage/orders/orders';
import { OrderDetail } from './pages/orders_manage/order-detail/order-detail';
import { Pagenotfound } from './pages/pagenotfound/pagenotfound';
import { AdminOrders } from './pages/orders_manage/orders/orders';
import { AdminOrderDetail } from './pages/orders_manage/order-detail/order-detail';
import { AdminUsers } from './pages/users_manage/users/users';
import { AdminUserDetail } from './pages/users_manage/user-detail/user-detail';
import { AdminUserForm } from './pages/users_manage/user-form/user-form';

@NgModule({
  declarations: [App, Pagenotfound],
  imports: [
    BrowserModule,
    AppRoutingModule,
    RouterOutlet,
    HttpClientModule,
    AdminLogin,
    Articles,
    ArticleEditor,
    AdminOrders,
    AdminOrderDetail,
    AdminUsers,
    AdminUserDetail,
    AdminUserForm,
    Orders,
    OrderDetail,
  ],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
