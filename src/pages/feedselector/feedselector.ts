//import { Debug } from './../../providers/debug';
import { Component } from '@angular/core';
import {
  ModalController,
  NavController, NavParams, ViewController, AlertController, ActionSheetController
} from 'ionic-angular';

import { AboutPage } from './../about/about';

@Component({
  selector: 'page-feedselector',
  templateUrl: 'feedselector.html'
})
export class FeedselectorPage {

  defaultFeeds: Array<Object> = [];
  customFeeds: Array<Object> = [];
  selectedFeeds: Object = {};

  itemlist: Array<Object> = [];

  pet: string = 'all';

  itemSelector: boolean = true;
  showAll: boolean = true;

  tags: Array<string> = [];
  tagSelection: Object = {};
  appSettings: Object = {};
  feedStatistics: Object = {};
  hallOfFame: Object = {};

  constructor(
    public alertCtrl: AlertController,
    public navCtrl: NavController,
    public navParams: NavParams,
  //  private debug: Debug,
    private modalCtrl: ModalController,
    private actionsheetCtrl: ActionSheetController,
    private viewCtrl: ViewController) { }

  ionViewDidLoad() {
    this.defaultFeeds = this.navParams.get('defaultFeeds');
    this.customFeeds = this.navParams.get('customFeeds');
    this.appSettings = this.navParams.get('appSettings');
    this.selectedFeeds = this.navParams.get('selectedFeeds');

    this.defaultFeeds.map(feed => {
      // add the tags
      let words =
        feed['tags'].toLowerCase()
          .replace(/['.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
          .replace(/\s{2,}/g, " ")
          .split(" ");

      words.map(word => {
        if ((this.tags.indexOf(word) < 0) && (word.length > 0)) {
          this.tags.push(word);
          this.tagSelection[word] = false;
        }
      });

      // any feeds for which we n't have settings?
      if (typeof this.selectedFeeds[feed['feedlabel']] === 'undefined')
        this.selectedFeeds[feed['feedlabel']] = false;

      this.tags.sort();
    });

    //TODO:remove doubleentries in defaultfeeds!

    // Sort feedoverview
    this.refreshFeedList();

    this.refreshListOnTags();
  }


  /**
  * Show the about page
  * 
  */
  openAbout() {

    // show the about page
    let modal = this.modalCtrl.create(AboutPage, {
      appSettings: this.appSettings,
      feedStatistics: this.feedStatistics //,
      //  model: {}, //this.wordlearner.getModel(),
      //  hallOfFame: this.hallOfFame
    }, { enableBackdropDismiss: true });

    modal.present();

    // handler for the action once the settings is closed
    modal.onDidDismiss((value) => {

      console.log('DEBUG receiving from about', value);

      // place the settings if we did receive anything (backdrop delivers undefined, ESC press null)
      if ((typeof value !== 'undefined') && (value !== null)) {

        // store the setting in the app
        this.appSettings = value['appSettings'];
        this.feedStatistics = value['feedStatistics'];
        //    this.hallOfFame = value['hallOfFame'];
      }
    });
  }

  toggleTagAll(value) {

    this.itemlist.map(item => {
      this.selectedFeeds[item['feedlabel']] = value;
    });
  }


  toggleAllTags(value) {

    this.tags.map(tag => {
      this.tagSelection[tag] = value
    });

    this.refreshListOnTags();
  }

  refreshListOnTags() {

    //this.itemlist = this.defaultFeeds.concat(this.customFeeds);
    this.refreshFeedList();

    // define all tags selected
    let selectedtags = [];
    this.tags.map(tag => {
      if (this.tagSelection[tag]) selectedtags.push(tag);
    });

    // go through all the tags and check if this feed has it
    this.itemlist = this.itemlist.filter((item) => {
      let ret = false;

      // not fully implemented yet
      if (item['tags'].length == 0) ret = true;

      // check the tags
      selectedtags.map(tag => {
        if (item['tags'].indexOf(tag) > -1) ret = true
      });
      return ret;
    });

  }

  toggleTag(tag) {
    this.tagSelection[tag] = !this.tagSelection[tag];

    this.refreshListOnTags();
  }

  refreshFeedList() {

    function compare(a, b) {
      if (a['prettylabel'].toLowerCase() < b['prettylabel'].toLowerCase()) {
        return -1;
      }
      if (a['prettylabel'].toLowerCase() > b['prettylabel'].toLowerCase()) {
        return 1;
      }
      // a must be equal to b
      return 0;
    }

    this.itemlist = this.defaultFeeds.concat(this.customFeeds);

    // sort all items for the view
    this.itemlist.sort(compare);
  }

  selectedFriends(value) {
    this.itemSelector = value;
    this.showAll = false;
  }

  selectAll() {
    this.showAll = true;
  }

  // return all the stuff
  addFeeds() {
    this.viewCtrl.dismiss({
      selectedFeeds: this.selectedFeeds,
      customFeeds: this.customFeeds,
      appSettings: this.appSettings,
      feedStatistics: this.feedStatistics,
    }).then((err) => { console.log('ERROR dismiss feedselector add', err) });
  }

  // empty return, so the caller see an undefined
  dismiss() {
    this.viewCtrl.dismiss().then((err) => { console.log('ERROR dismiss feedselector empty', err) });
  }

  openActionSheet() {
    let actionSheet = this.actionsheetCtrl.create({
      title: 'Feed actions',
      cssClass: 'action-sheets-basic-page',
      buttons: [

        /*
                {
                  text: 'Add Custom RSS',
                  //role: 'destructive',
                  icon: 'logo-rss',
                  handler: () => {
                    this.addCustomRSS();
                    //        this.debug.log('Delete clicked');
                  }
                },
        */
        {
          text: 'Add Twitter',
          //role: 'destructive',
          icon: 'logo-twitter',
          handler: () => {
            this.addTwitter();
            //        this.debug.log('Delete clicked');
          }
        },
        {
          text: 'Add Instagram',
          icon: 'logo-instagram',
          handler: () => {
            this.addInstagram();
          }
        },
        {
          text: 'Add Pinterest',
          icon: 'logo-pinterest',
          handler: () => {
            this.addPinterest();
            //          this.debug.log('Play clicked');
          }
        },
        {
          text: 'Cancel',
          role: 'cancel', // will always sort to be on the bottom
          icon: 'cancel',
          handler: () => {
            //      this.debug.log('Cancel clicked');
          }
        }
      ]
    });
    actionSheet.present();
  }


  addCustomRSS() {
    let prompt = this.alertCtrl.create({
      title: 'Custom RSS',
      message: "Enter the URL of the RSS (no checking!)",
      inputs: [
        {
          name: 'username',
          placeholder: 'RSS URL'
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          handler: data => {
          }
        },
        {
          text: 'Add',
          handler: data => {

            let feedlabel = "Custom RSS " + Date.now();
            this.selectedFeeds[feedlabel] = true;

            this.customFeeds.push({
              "feedlabel": feedlabel,
              "prettylabel": "CUSTOM RSS " + data.username,
              "feedurl": data.username,
              "tags": "news",
              "refreshinterval": 6000,
              "responsefilter": "standard",
              "itemfilter": "standard",
              "defaultthumb": "assets/img/newzee.png"
            });

            this.refreshFeedList();
          }
        }
      ]
    });
    prompt.present();
  }


  addTwitter() {
    let prompt = this.alertCtrl.create({
      title: 'Twitter',
      message: "Enter a name of the Twitter user",
      inputs: [
        {
          name: 'username',
          placeholder: 'Twitter username'
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          handler: data => {
          }
        },
        {
          text: 'Add',
          handler: data => {

            let feedlabel = "Twitter " + data.username + Date.now();
            this.selectedFeeds[feedlabel] = true;

            this.customFeeds.push({
              "feedlabel": feedlabel,
              "prettylabel": "Twitter " + data.username,
              "feedurl": "https://queryfeed.net/tw?q=%40" + data.username,
              "tags": "twitter",
              "refreshinterval": 6000,
              "responsefilter": "standard",
              "itemfilter": "standard",
              "defaultthumb": "assets/img/newzee.png"
            });

            this.refreshFeedList();
          }
        }
      ]
    });
    prompt.present();
  }


  addPinterest() {
    let prompt = this.alertCtrl.create({
      title: 'Pinterest',
      message: "Enter a name of the Pinterest user",
      inputs: [
        {
          name: 'username',
          placeholder: 'Pinterest username'
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          handler: data => {
          }
        },
        {
          text: 'Add',
          handler: data => {

            let feedlabel = "Pinterest " + data.username + Date.now();
            this.selectedFeeds[feedlabel] = true;

            this.customFeeds.push({
              "feedlabel": feedlabel,
              "prettylabel": "Pinterest " + data.username,
              "feedurl": "https://nl.pinterest.com/" + data.username + '/feed.rss/',
              "tags": "pinterest",
              "refreshinterval": 6000,
              "responsefilter": "standard",
              "itemfilter": "standard",
              "defaultthumb": "assets/img/newzee.png"
            });

            this.refreshFeedList();
          }
        }
      ]
    });
    prompt.present();
  }


  addInstagram() {
    let prompt = this.alertCtrl.create({
      title: 'Instagram',
      message: "Enter a name of the Instagram user",
      inputs: [
        {
          name: 'username',
          placeholder: 'Instagram username'
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          handler: data => {
          }
        },
        {
          text: 'Add',
          handler: data => {

            let feedlabel = "Instagram " + data.username + Date.now();
            this.selectedFeeds[feedlabel] = true;

            this.customFeeds.push({
              "feedlabel": feedlabel,
              "prettylabel": "Instagram " + data.username,
              "feedurl": "https://queryfeed.net/instagram?q=" + data.username,
              "tags": "instagram",
              "refreshinterval": 6000,
              "responsefilter": "standard",
              "itemfilter": "standard",
              "defaultthumb": "assets/img/newzee.png"
            });

            this.refreshFeedList();
          }
        }
      ]
    });
    prompt.present();
  }

}
