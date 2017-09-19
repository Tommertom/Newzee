import { Injectable } from '@angular/core';
import { Events } from 'ionic-angular';

import { BrowserModule } from '@angular/platform-browser';
import { ErrorHandler, NgModule } from '@angular/core';
import { IonicApp, IonicErrorHandler, IonicModule } from 'ionic-angular';
import { SplashScreen } from '@ionic-native/splash-screen';
import { StatusBar } from '@ionic-native/status-bar';

import { HttpModule } from '@angular/http';
import { IonicStorageModule } from '@ionic/storage';

import { SocialSharing } from '@ionic-native/social-sharing';
import { InAppBrowser } from '@ionic-native/in-app-browser';

// app pages
import { MyApp } from './app.component';
import { HomePage } from '../pages/homepage/homepage';
import { NewsPopoverPage } from '../components/newspopover.component';
import { HallOfFamePage } from '../pages/halloffame/halloffame.component';
import { FeedselectorPage } from './../pages/feedselector/feedselector';
import { NewsAggregatorService } from './../providers/newsaggregator.services';
import { Db } from './../providers/db';

@Injectable()
export class Ionic2ErrorHandler extends IonicErrorHandler implements ErrorHandler {
  constructor(private events: Events) {
    super();
  }
  handleError(err: any): void {
    super.handleError(err);
    console.log('INTO ERROR HANDLER', err.toString());
    this.events.publish('progress', { 'value': 0, 'total': 1, 'text': err.toString(), 'error': true });
  }
}

@NgModule({
  declarations: [
    MyApp,
    HomePage,
    HallOfFamePage,
    NewsPopoverPage,
    FeedselectorPage,
  ],
  imports: [
    BrowserModule, HttpModule,
    IonicModule.forRoot(MyApp),
    IonicStorageModule.forRoot({
      name: 'newzeedb3',
      driverOrder: ['sqlite', 'indexeddb', 'websql'] //
    })
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    HomePage,
    HallOfFamePage,
    NewsPopoverPage,
    FeedselectorPage
  ],
  providers: [
    StatusBar,
    SplashScreen,
    Db,
    // HTTP,
    StatusBar, SplashScreen,

    SocialSharing, InAppBrowser,

    NewsAggregatorService,

    { provide: ErrorHandler, useClass: Ionic2ErrorHandler }
  ]
})
export class AppModule { }
