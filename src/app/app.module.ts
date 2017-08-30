
import { BrowserModule } from '@angular/platform-browser';
import { ErrorHandler, NgModule } from '@angular/core';
import { IonicApp, IonicErrorHandler, IonicModule } from 'ionic-angular';
import { SplashScreen } from '@ionic-native/splash-screen';
import { StatusBar } from '@ionic-native/status-bar';

import {HttpModule} from '@angular/http'; 
import { IonicStorageModule } from '@ionic/storage';

import { SocialSharing } from '@ionic-native/social-sharing';
import { InAppBrowser } from '@ionic-native/in-app-browser';

import { MyApp } from './app.component';
import { HomePage } from '../pages/home/home';


// app pages
import { Page1 } from '../pages/page1/page1';
import { NewsPopoverPage } from '../pages/page1/newspopover.component';
import { HallOfFamePage } from '../pages/page1/halloffame.component';
import { FeedselectorPage } from './../pages/feedselector/feedselector';
import { AboutPage } from '../pages/about/about';
import { Sortpipe } from './../pipes/sortpipe';


import { NewsAggregatorService } from './../providers/newsaggregator.services';
import { Db } from './../providers/db';
import { Debug } from './../providers/debug';

import { Injectable } from '@angular/core';
import { Events } from 'ionic-angular';

//import { HTTP } from '@ionic-native/http';

@Injectable()
export class Ionic2ErrorHandler extends IonicErrorHandler implements ErrorHandler {
  constructor(private events: Events) {
    super();
  }
  /**
   * @internal
   */
  handleError(err: any): void {
    super.handleError(err);

    console.log('INTO ERROR HANDLER', err.toString());
    this.events.publish('progress', { 'value': 0, 'total': 1, 'text': err.toString(), 'error': true });

    //this.debug.log('EXCEPTION ' + JSON.stringify(err, null, 2));
  }
}

@NgModule({
  declarations: [
    MyApp,
    HomePage,
    Page1,
    AboutPage, HallOfFamePage,
    NewsPopoverPage,
    FeedselectorPage,
    Sortpipe
  ],
  imports: [
    BrowserModule,HttpModule,
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
    Page1,
    AboutPage, HallOfFamePage,
    NewsPopoverPage,
    FeedselectorPage
  ],
  providers: [
    StatusBar,
    SplashScreen,
    Db, Debug,
   // HTTP,
  //  Http,
    //HTTP,
    //FeedCollectionService,
    StatusBar, SplashScreen,

    SocialSharing, InAppBrowser,

    NewsAggregatorService,

    { provide: ErrorHandler, useClass: Ionic2ErrorHandler }
  ]
})
export class AppModule { }
