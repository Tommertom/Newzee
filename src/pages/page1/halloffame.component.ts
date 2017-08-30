
import { Component } from '@angular/core';


import { Events, ViewController, NavParams, PopoverController } from 'ionic-angular';

import { NewsPopoverPage } from './newspopover.component';

import { InAppBrowser } from '@ionic-native/in-app-browser';


//import { SocialSharing } from 'ionic-native';
//import { ElementRef, ViewChild } from '@angular/core';

// for the cordova plugin check if we are running ionic serve
//declare var window;

@Component({
  templateUrl: 'halloffame.html'
})
export class HallOfFamePage {

  hallOfFame: Object = {};
  hallOfFameList: Array<Object> = [];

  //  @ViewChild('myElement') myElement: ElementRef;

  constructor(
    public viewCtrl: ViewController,
    private navParams: NavParams,
    private popoverCtrl: PopoverController,
    public events: Events,
    private iab: InAppBrowser
  ) { }


  pressEvent(item, event) {
    // tslint message avoid
    let browser;
    browser = this.iab.create(item['link'], '_system'); // avoid tslint issue
    browser.show();
  }


  clickEvent(item, event) {

    // create the popover
    let popover = this.popoverCtrl
      .create(NewsPopoverPage, { data: item }, { enableBackdropDismiss: true });

    // present the popover, no event passed, so it will be centered
    popover.present({});
  }


  ionViewDidLoad() {
    this.hallOfFame = this.navParams.get('hallOfFame');
    this.hallOfFameList = Object.keys(this.hallOfFame);
  }

  close() {
    this.viewCtrl.dismiss({ hallOfFame: this.hallOfFame });
  }
}


/*

        <ion-scroll scrollY="true">
<ion-list no-lines>

    <ion-item-sliding *ngFor="let hashcode of hallOfFameList" #slider>
      <ion-item >
        <ion-thumbnail item-left style="margin-top:0px;margin-bottom:0px">
          <ion-img [src]="hallOfFame[hashcode].thumbnail"></ion-img>
        </ion-thumbnail>
        <b style="font-size:85%" [innerHTML]="hallOfFame[hashcode].title"></b>
        <span style="color: gray;font-size:70%;position:absolute; bottom:0;right:0px;">{{hallOfFame[hashcode].prettylabel}}</span>
      </ion-item>

      <ion-item-options side="left">
        <button ion-button color="primary" (click)="toggleFavorite(newsData[item], slider)" icon-left>
          <ion-icon name="heart"></ion-icon>Item
        </button>
        <button ion-button color="secondary" (click)="doSocialShare(newsData[item], slider)" icon-left>
          <ion-icon name="share-alt"></ion-icon>Share
        </button>
        <button ion-button color="danger" (click)="deleteItem(newsData[item], slider)" icon-left>
          <ion-icon name="trash"></ion-icon>Item
        </button>
      </ion-item-options>


    </ion-item-sliding>

  </ion-list>


        </ion-scroll>
*/

