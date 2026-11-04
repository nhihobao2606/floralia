import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { AdminLogin } from './pages/admin-login/admin-login';
import { Articles } from './pages/articles_manage/articles/articles';
import { ArticleEditor } from './pages/articles_manage/article-editor/article-editor';
import { Pagenotfound } from './pages/pagenotfound/pagenotfound';
import { AdminOrders } from './pages/orders_manage/orders/orders';

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
  ],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
