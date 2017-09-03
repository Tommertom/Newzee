
import { Component } from '@angular/core';

import { Events, ViewController, NavParams, ToastController } from 'ionic-angular';

import { SocialSharing } from '@ionic-native/social-sharing';
import { InAppBrowser } from '@ionic-native/in-app-browser';


import { ViewChild, ElementRef } from '@angular/core';

//declare var ColorThief: any;

@Component({
  template: `
        <ion-scroll scrollY="true">
        <span> <ion-icon (tap)="doSocialShare()"  name="share-alt" [color]="shareColor" style="font-size: 280%;position:absolute; top:0;right:10px;"></ion-icon></span>
            <img #myElement [src]="newsItem.thumbnail" style="height:250px;width:500px" (tap)="closePopover()" (click)="closePopover()">
            <ion-row no-padding>
              <ion-col text-left>
              <button ion-button clear small color="danger" icon-left (tap)="toggleFavorite()" > 
                <ion-icon *ngIf="!isFavorite" name="heart-outline"></ion-icon>
                <ion-icon *ngIf="isFavorite" name="heart"></ion-icon>
              </button>
              </ion-col>
              <ion-col text-center>
                <button (tap)="openBrowser(newsItem.link)" ion-button clear small color="danger" icon-left>       
                  Open Browser
                </button>
              </ion-col>
            </ion-row>
            <small>(C) {{newsItem.prettylabel}}</small>
              <p style="padding:5px" text-justify [innerHTML]="newsItem.description" (tap)="closePopover()" (click)="closePopover()"> </p>
            <br>
              <small style="color:gray;position:absolute; right:3px;">{{howOld}}</small>
              <br><br><br>
        </ion-scroll>
  `
})
export class NewsPopoverPage {

  newsItem: any = {};
  howOld: string = '';

  // relpercentage: number = 0
  isFavorite: boolean = false;
  canClose: boolean = true;
  shareColor: string = 'white';
  debugData: string = 'no debug';

  @ViewChild('myElement') myElement: ElementRef;

  constructor(
    public viewCtrl: ViewController,
    private navParams: NavParams,
    public events: Events,
    public tstCntrllr: ToastController,
    private socialSharing: SocialSharing,
    private iab: InAppBrowser
  ) {
    this.newsItem = this.navParams.get('data');

    // get the favorite marker
    this.isFavorite = this.newsItem['favorite'];

    // how old? age in seconds -- below is not really really best coding (not really DRY)
    let age = Math.round((Date.now() - new Date(this.newsItem['pubTime']).getTime()) / 1000);

    // counting days?
    this.howOld = '';
    let testage = Math.round(age / (60 * 60 * 24));
    if (testage >= 1) this.howOld = testage.toString() + 'd ';

    // or just hours
    testage = Math.round(age / (60 * 60));
    if (this.howOld === '')
      if (testage >= 1) this.howOld = testage.toString() + 'h '

    // minutes?
    testage = Math.round(age / (60));
    if (this.howOld === '')
      if (testage >= 1) this.howOld = testage.toString() + 'm '

    // go for seconds
    if (this.howOld === '')
      this.howOld = testage.toString() + 's '

    // or if we don't know the age (can happen)
    if (age < 0) this.howOld = 'unknown age ';
  }

  doSocialShare() {
    this.canClose = false;

    // check if the plugin is there to ensure ionic serve does not give issues
    this.socialSharing.share(
      "", this.newsItem['description'], [], this.newsItem['link']);

    // hack to prevent bubbling
    setTimeout(() => {
      this.canClose = true;
    },
      200);
  }

  ionViewDidLoad() {
    // let's estimate if the image is too white - BLANKED OUT NOG EEN KEER CHECKEN
    //  let colorThief = new ColorThief();
    //   let color = colorThief.getPalette(this.myElement.nativeElement, 5);
    //  this.debugData = JSON.stringify(color, null, 2);
    //console.log('DEBUG get colors p', this.myElement, this.debugData);
    //  color.map(color => {
    //  if (color[0] + color[1] + color[2] > 3 * 200) this.shareColor = 'black';
    //  });
    //
  }


  toggleFavorite() {
    this.isFavorite = !this.isFavorite;

    //use the eventbus, as we want to allow a backdrop 
    let hashcode = this.newsItem['hashcode'];
    this.events.publish('toggle-favorite', { 'hashcode': hashcode, 'isFavorite': this.isFavorite, 'item': this.newsItem });
  }

  openBrowser(url: string) {
    let browser;
    browser = this.iab.create(url, '_system'); 
    browser.show();

    this.canClose = true;
    this.closePopover();
  }

  closePopover() {
    if (this.canClose) {
      let retvalue = {};
      retvalue[this.newsItem.hashcode] = this.isFavorite;

      this.viewCtrl.dismiss(retvalue);
    }
  }
}