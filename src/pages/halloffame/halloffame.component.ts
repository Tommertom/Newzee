import { Component } from '@angular/core';
import { Events, ViewController, NavParams, PopoverController } from 'ionic-angular';

import { InAppBrowser } from '@ionic-native/in-app-browser';
import { SocialSharing } from '@ionic-native/social-sharing';

import { NewsPopoverPage } from '../../components/newspopover.component';

@Component({
  templateUrl: 'halloffame.html'
})
export class HallOfFamePage {

  hallOfFame: Object = {};
  hallOfFameList: Array<Object> = [];

  constructor(
    public viewCtrl: ViewController,
    private navParams: NavParams,
    private popoverCtrl: PopoverController,
    public events: Events,
    private socialSharing: SocialSharing,
    private iab: InAppBrowser
  ) { }

  pressEvent(item, event) {
    let browser;
    browser = this.iab.create(item['link'], '_system');
    browser.show();
  }

  doSocialShare(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();
    this.socialSharing.share("", item['description'], [], item['link']);
  }

  clickEvent(item, event) {
    // create the popover
    let popover = this.popoverCtrl
      .create(NewsPopoverPage, { data: item }, { enableBackdropDismiss: true });

    // present the popover, no event passed, so it will be centered
    popover.present({});

    // remove any item which has been removed in the popover
    popover.onDidDismiss((value) => {
      Object.keys(value).map(hashcode => {
        if (!value[hashcode]) {
          delete (this.hallOfFame[hashcode])
        }
      })
      this.makeHOFlist();
    });
  }

  makeHOFlist() {

    this.hallOfFameList = [];

    // turn into a list
    Object.keys(this.hallOfFame).map(hashcode => {
      this.hallOfFameList.push(this.hallOfFame[hashcode]);
    })

    // sort the list
    this.hallOfFameList.sort(
      (a, b) => {
        // console.log('SORT',a,b);
        if (a['pubTime'] > b['pubTime']) {
          return -1;
        }
        if (a['pubTime'] < b['pubTime']) {
          return 1;
        }
        return 0;
      });
  }

  ionViewDidLoad() {
    this.hallOfFame = this.navParams.get('hallOfFame');
    this.makeHOFlist();
  }

  close() {
    this.viewCtrl.dismiss({ hallOfFame: this.hallOfFame });
  }
}