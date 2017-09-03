import { Component, ViewChild } from '@angular/core';

import { Platform } from 'ionic-angular';

import { Http } from '@angular/http';

import { SocialSharing } from '@ionic-native/social-sharing';
import { InAppBrowser } from '@ionic-native/in-app-browser';

import {
  FabContainer, Content,
  ModalController, PopoverController,
  Events, Keyboard, ToastController
} from 'ionic-angular';

import { NewsPopoverPage } from '../../components/newspopover.component';
import { FeedselectorPage } from './../feedselector/feedselector';
import { HallOfFamePage } from '../halloffame/halloffame.component';

import { NewsAggregatorService } from './../../providers/newsaggregator.services';
import { Db } from './../../providers/db';


/**
 * Component HomePage 
 * 
 * Holds the main page for the news reader 
 */
@Component({
  selector: 'page-homepage',
  templateUrl: 'homepage.html'
})
export class HomePage {

  appVersion: Object = {
    'latestVersion': '0.1.21',
    'changeLog': [
      'Custom feeds',
      'UI overhaul',
      'Webapp tests',
      'Reworked internal engine. Added copy/paste for webapp.',
      'Techbullion added',
      'Tutorial fixes and major overhaul of code',
      'Fixed Bright code and code cleaning',
      'Fixed error handling and feed fix',
      'Sliding changed to left + tutorial update',
      'Changed layout popover and button position',
      'Added Mashable',
      'Created version info. Added feeds. Experimenting with position of buttons.BBC feed fix.'
    ]
  };

  loadedItems: Array<Object> = [];
  bufferedItems: Array<Object> = [];
  seenItems: Array<string> = [];
  itemCount: number = 0;
  hallOfFame: Object = {};

  // collections of feeds available and selected
  selectedFeeds: Object = { 'NewZeeTutorial': true }; // set the tutorial as default to true
  defaultFeeds: Array<Object> = [];
  customFeeds: Array<Object> = [];
  debuginfo: string = "";

  // overall app settings  
  appSettings: Object = {
    'maxAge': 2,
    'maxItemsInView': 225,
    'refreshTime': 500,
    'pageScrollTime': 0,
    'bubbleDelay': 900,
    'debug': false,
    'toastdebug': false,
    'sortdate': true
  };

  // the newsfeed subscribed too
  newsSubscription: any;

  // for UI easening
  lastUserAction: number = 0; // time of the last user action
  isLoading: boolean = false;
  progressPercentage: string = "0%";

  // needed for the scrollToTop and monitoring the scrolling progress (lazy loading image)
  @ViewChild(Content) content: Content;

  constructor(
    private modalCtrl: ModalController,
    private popoverCtrl: PopoverController,
    private newsservice: NewsAggregatorService,
    public keyboard: Keyboard,
    private toastCtrl: ToastController,
    public events: Events,
    public db: Db,
    private http: Http,
    private platform: Platform,
    private iab: InAppBrowser,
    private socialSharing: SocialSharing
  ) { }

  /**
   * Lifecycle hook whenever the app is closed or loses focus, will save all stuff
   * 
   */
  ionViewWillEnter() {
    this.lastUserAction = 0;
    setTimeout(() => {
      this.platform.ready().then(() => {
        this.db.initDB().then(() => {
          this.loadSettingsAndData();
        });
      });
    }, 500);
  }

  ionViewDidLoad() {
    // event subscription -  a bit of an oddity here, needed to support backdrop click for PopoverPage
    this.events.subscribe('toggle-favorite', (data) => {
      let hashcode = data['hashcode'];

      this.hallOfFame[hashcode] = data['item'];
      data['item']['favorite'] = !data['item']['favorite'];
    });

    this.events.subscribe('progress', (data) => {
      this.progressPercentage = Math.round((100 * data['value']) / data['total']).toString() + '%';

      if (data.error)
        this.debuginfo += ('\nERROR ' + data.text);
    });
  }
  // END OF LIFECYCLE HOOKS

  //
  // UI workers
  //
  toggleFavorite(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();
    item['favorite'] = !item['favorite'];
    this.hallOfFame[item['hashcode']] = item;
  }

  doSocialShare(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();
    this.socialSharing.share("", item['description'], [], item['link']);
  }

  deleteItem(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();
    this.deleteNewsItem(item);
  }

  deleteFeed(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();

    // remove all items with the same label
    let feedlabel = item['feedlabel'];

    // find the entries that need to get deleted
    for (let i = this.loadedItems.length - 1; i > -1; i--)
      if (this.loadedItems[i]['feedlabel'] == feedlabel) {

        // add it to the seen items
        if (this.seenItems.indexOf(this.loadedItems[i]['hashcode']) < 0)
          this.seenItems.push(this.loadedItems[i]['hashcode']);

        // remove it
        this.loadedItems.splice(i, 1);
        this.itemCount--;
      }

    // remove from the settings
    this.selectedFeeds[item['feedlabel']] = false;

    // save the stuff
    this.saveSettingsAndData();
  }

  fabContainerClick() {
    this.lastUserAction = Date.now();
  }

  stepScrollUp() {
    let contentDimensions = this.content.getContentDimensions();
    let y = contentDimensions['scrollTop'] - contentDimensions['contentHeight'] + 55;
    this.content.scrollTo(0, y, this.appSettings['pageScrollTime']);
  }

  stepScrollDown() {
    let contentDimensions = this.content.getContentDimensions();
    let y = contentDimensions['scrollTop'] + contentDimensions['contentHeight'] - 55;
    this.content.scrollTo(0, y, this.appSettings['pageScrollTime']);
  }

  /**
   * Scroll the view to the top
   * 
   * @param {FabContainer} fab - The reference to the FAB Container which it needs to close
   */
  scrollToTop(fab?: FabContainer) {
    if ((fab !== null) && (typeof fab !== 'undefined')) fab.close();
    this.content.scrollToTop(5);
  }

  /**
   * Handle UI events to initiate refresh
   * 
   */
  doPushRefresh(fab?) {
    if ((fab !== null) && (typeof fab !== 'undefined')) fab.close();
    if (!this.isLoading) this.doRefresh();
  }

  doPullRefresh(refresher?) {
    if ((refresher !== null) && (typeof refresher !== 'undefined')) refresher.complete();
    this.doRefresh();
  }

  /**
   * Move all items shown in the view to the seen list, but not the ones marked as favorite
   * 
   * @param {FabContainer} fab - The reference to the FAB Container which it needs to close
   */
  seenAllItems(fab: FabContainer) {

    // register the user action 
    this.lastUserAction = Date.now();

    // close the fab
    if ((fab !== null) && (typeof fab !== 'undefined')) fab.close();

    for (var i = this.loadedItems.length - 1; i >= 0; i--) {

      // only delete items which are not marked favorite
      if (!this.loadedItems[i]['favorite']) {

        if (this.seenItems.indexOf(this.loadedItems[i]['hashcode']) < 0)
          this.seenItems.push(this.loadedItems[i]['hashcode']);

        this.loadedItems.splice(i, 1);
        this.itemCount--;
      }
    }

    this.updateView();

    this.saveSettingsAndData();
  }

  //
  // Handling of new pages
  //
  showHallOfFame(slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();

    // show the page and we pass quite some data .... 
    let popover = this.modalCtrl.create(HallOfFamePage, {
      hallOfFame: this.hallOfFame
    }, { enableBackdropDismiss: true });

    popover.present();

    popover.onDidDismiss(value => {
      if (value['hallOfFame'])
        this.hallOfFame = value['hallOfFame'];
    })
  }

  /**
   * Show the feedselector page
   * 
   * @param {FabContainer} fab - The reference to the FAB Container which it needs to close
   */
  showFeedSelector(fab?: FabContainer) {
    // close the fab container list
    if ((fab !== null) && (typeof fab !== 'undefined')) fab.close();

    // show the page and we pass quite some data .... 
    let modal = this.modalCtrl.create(FeedselectorPage, {
      defaultFeeds: this.defaultFeeds,
      customFeeds: this.customFeeds,
      selectedFeeds: this.selectedFeeds,
    }, { enableBackdropDismiss: true });

    modal.present();

    // handler for the action once the settings is closed
    modal.onDidDismiss((value) => {

      // place the settings if we did receive anything (backdrop delivers undefined, ESC press null)
      if ((typeof value !== 'undefined') && (value !== null)) {

        // store the setting in the app
        this.selectedFeeds = value.selectedFeeds;
        this.customFeeds = value.customFeeds;

        this.scrollToTop();

        this.saveSettingsAndData();
      }
    });
  }

  /**
  * Press event - go to deeplink
  * 
  * @param {Event} event - The event passed on
  * @param {Object} item - The newsitem
  */
  pressEvent(item, event) {

    if (Date.now() - this.lastUserAction > this.appSettings['bubbleDelay']) {

      this.saveSettingsAndData();

      // register the user action
      this.lastUserAction = Date.now();

      // open the site
      let browser;
      browser = this.iab.create(item['link'], '_system'); // avoid tslint issue
      browser.show();
    }
  }

  /**
   * Click event - show the popover
   * 
   * @param {Event} event - The event passed on
   * @param {Object} item - The newsitem
   */
  clickEvent(item, event) {

    // hack for propagation of press event
    if (Date.now() - this.lastUserAction > this.appSettings['bubbleDelay']) {

      // register the user action
      this.lastUserAction = Date.now();

      // create the popover
      let popover = this.popoverCtrl
        .create(NewsPopoverPage, { data: item }, { enableBackdropDismiss: true });

      // present the popover, no event passed, so it will be centered
      popover.present({});
    }
  }

  // Other internal stuff
  doRefresh() {

    this.debuginfo = "";

    // allow for full loading, only if loading is not already in progress
    if (!this.isLoading) {
      this.isLoading = true;

      // load the feeds from the active feeds
      this.newsSubscription = this.newsservice.loadRSSFeeds(

        // we are only looking at the feeds selected
        this.defaultFeeds.concat(this.customFeeds)
          .filter(feed => {
            return this.selectedFeeds[feed['feedlabel']]
          })

      )
        .filter((item) => {

          // we are going to add this item, unless otherwise is defined below
          let additem = true;
          let hashcode = item['hashcode'];

          // is the item already in the database? e.g. seen??
          if (this.seenItems.indexOf(hashcode) > -1) additem = false;

          // check the date
          if ((Date.now() - item['pubTime']) > (this.appSettings['maxAge'] * 24 * 60 * 60 * 1000))
            additem = false;

          return additem;
        })
        .toArray()
        .subscribe(
        (newitems) => {
          this.bufferedItems = newitems;
          this.updateView();
        },
        (item) => {
          this.events.publish('progress', { 'value': 0, 'total': 1, 'text': '' });
          this.isLoading = false;
          this.updateView();
        },
        (item) => {
          this.events.publish('progress', { 'value': 0, 'total': 1, 'text': '' });
          this.isLoading = false;
          this.updateView();
        })
    }
  }

  deleteNewsItem(item) {
    if (this.seenItems.indexOf(item['hashcode']) < 0)
      this.seenItems.push(item['hashcode']);

    // find the entries that need to get deleted
    for (let i = this.loadedItems.length - 1; i > -1; i--)
      if (this.loadedItems[i]['hashcode'] == item['hashcode']) {
        this.loadedItems.splice(i, 1);
        this.itemCount--;
      }
  }

  updateView() {
    // concat all items 
    //console.log('SADSDA1', this.loadedItems.length, this.bufferedItems.length);
    this.loadedItems = this.loadedItems.concat(this.bufferedItems)
    this.loadedItems.sort((a, b) => {
      if (a['pubTime'] > b['pubTime']) {
        return -1;
      }
      if (a['pubTime'] < b['pubTime']) {
        return 1;
      }
      return 0;
    });

    //  console.log('SADSDA2', this.loadedItems.length, this.bufferedItems.length);
    this.bufferedItems = this.loadedItems.slice(this.appSettings['maxItemsInView']);
    this.loadedItems = this.loadedItems.slice(0, this.appSettings['maxItemsInView']);
    //    console.log('SADSDA3', this.loadedItems.length, this.bufferedItems.length);

    this.itemCount = this.loadedItems.length;

    this.scrollToTop();
  }

  /** 
   * Does a plain toast message on bottom of the page
   * 
   * Holds the main page for the news reader 
   * @param {string} message - The message to be toasted
   * @param {number} duration - Duration of the toast message
   * @returns {} nothing
  */
  doToast(message, duration) {
    let toast = this.toastCtrl.create({
      message: message,
      duration: duration,
      position: 'bottom',
      showCloseButton: true
    });

    toast.present();
  }

  debuglog(s) {
    this.debuginfo = this.debuginfo + '<br>' + s;
  }

  saveSettingsAndData() {
    this.debuglog('DEBUG saving data');

    // clear seen items but make sure not too many are stored
    this.debuglog('SEEN ITEM COUNT ' + this.seenItems.length);
    if (this.seenItems.length > 2000) {
      this.seenItems = this.seenItems.slice(-100);
      this.debuglog('CUTTING' + this.seenItems.length);
    }

    this.db.setkey('seenItems', this.seenItems)
      .then(re => { this.debuglog('Setting seenItems ' + this.seenItems.length.toString()) });

    // save the custom feeds
    this.db.setkey('customFeeds', this.customFeeds)
      .then(re => { this.debuglog('Setting cf') });

    // hall of fame
    this.db.setkey('hallOfFame', this.hallOfFame)
      .then(re => { this.debuglog('Setting hf'); });

    // app settings
    this.db.setkey('appSettings', this.appSettings)
      .then(re => { this.debuglog('Setting as'); });

    // statistics
    this.db.setkey('feedStatistics', {})//this.feedStatistics)
      .then(re => { this.debuglog('Setting fs'); });

    this.db.setkey('selectedFeeds', this.selectedFeeds)
      .then(re => { this.debuglog('Setting sf'); });
  }

  loadSettingsAndData() {
    // do the version update info 
    this.db.getkey('versioncount').then(
      (val) => {
        let versioncount = 0;

        // first time run, no toast
        if (val !== null) {
          versioncount = this.appVersion['changeLog'].length;
          this.db.setkey('versioncount', this.appVersion['changeLog'].length);
        } else
          // show toast if there was an update
          if (versioncount < this.appVersion['changeLog'].length) {

            // build the toast text from the array with the changelog
            let changelogtext = '';
            for (let i = 0; i < (this.appVersion['changeLog'].length - versioncount); i++)
              changelogtext = changelogtext + ' -  ' + this.appVersion['changeLog'][i];

            this.doToast('APP UPDATE (v' + this.appVersion['latestVersion'] + '):' + changelogtext, 15000);

            this.db.setkey('versioncount', this.appVersion['changeLog'].length);
          }
      })
      .catch(err => { this.debuglog('ERROR vc' + JSON.stringify(err)) })

    // load the app settings
    this.db.getkey('appSettings').then(
      (val) => {
        // in case we add settings to the default, this ensures we have them for the next time
        if (val != null) {
          Object.keys(val).map((key) => {
            this.appSettings[key] = val[key];
          });
        }
      })
      .catch(err => { this.debuglog('ERROR as' + JSON.stringify(err)) })

    // load the hall of fame
    this.db.getkey('hallOfFame').then(
      (val) => {
        this.debuglog('DEBUG hof type ' + typeof val);
        if (val != null) {
          this.hallOfFame = val;
          this.debuglog('DEBUG loaded existing hall of fame');
        }
      })
      .catch(err => { this.debuglog('ERROR hf' + JSON.stringify(err)) })

    // load the seenItems
    this.db.getkey('seenItems').then(
      (val) => {
        if (val != null) {
          this.seenItems = []; //val;
          this.debuglog('SEEN ITEMS COUNT :' + this.seenItems.length.toString());
        }
      })
      .catch(err => { this.debuglog('ERROR seenitems' + JSON.stringify(err)) })

    // load the statistics
    this.db.getkey('feedStatistics').then(
      (val) => {
        this.debuglog('DEBUG stat type ' + typeof val);
        this.debuglog('DEBUG loaded feedstatistics');
      })
      .catch(err => { this.debuglog('ERROR fs' + JSON.stringify(err)) })

    // load the settings for enabled service
    this.db.getkey('selectedFeeds').then(
      (val) => {
        this.debuglog('DEBUG selectedfeeds ' + typeof val);

        if (val != null) {
          this.selectedFeeds = val;

          this.debuglog('Loading selected feeds' + Object.keys(this.selectedFeeds).length.toString());

          // if there is no enabled services, then force selection of a feed
          if (Object.keys(val).length == 0) {
          } else {
            this.selectedFeeds = val;
          }
        }
      })
      .catch(err => { this.debuglog('ERROR sf' + JSON.stringify(err)) })

    // configure the feeds, need to save settings of deleted feeds (FUTURE)
    this.http.get('assets/newsfeeds.json')
      .map(res => res.json())
      .subscribe(res => {
        this.defaultFeeds = res;

        //  any feeds custom added
        this.db.getkey('customFeeds').then(
          (val) => {
            if (val != null)
              this.customFeeds = val;
          });
      })
  }
}