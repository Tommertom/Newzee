import { HallOfFamePage } from './halloffame.component';
import { Http } from '@angular/http';
//import { Debug } from './../../providers/debug';
import { Db } from './../../providers/db';

import { Platform } from 'ionic-angular';
import { SocialSharing } from '@ionic-native/social-sharing';
import { InAppBrowser } from '@ionic-native/in-app-browser';

import { Component, ViewChild } from '@angular/core';

//import { Observable } from "rxjs/Rx";

import {
  FabContainer, Content, //NavController,
  ModalController, PopoverController, //LoadingController,
  Events, Keyboard, ToastController
} from 'ionic-angular';

import { NewsPopoverPage } from './newspopover.component';
import { FeedselectorPage } from './../feedselector/feedselector';

import { NewsAggregatorService } from './../../providers/newsaggregator.services';
import 'rxjs/Rx'; // unsure why this is needed (HTTP needs it???)

//import { Storage } from '@ionic/storage';

declare var window; // for the social share plugin testing

/**
 * Component Page1 
 * 
 * Holds the main page for the news reader 
 */
@Component({
  selector: 'page-page1',
  templateUrl: 'page1.html'
})
export class Page1 {

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

  // collections of newsitems
  newsData: Object = {}; // the loaded newsitems, full data out of the http
  // newsIndex: Array<string> = []; // used to fill the view
  newsIndex: Array<string> = []; // all items (hashcode array) for the view
  newsBuffer: Array<string> = []; // all items buffered after the limit is reached

  loadedItems: Array<Object> = [];
  itemsInView: Array<Object> = [];
  seenItems: Array<string> = []; // the ones seen

  itemCount: number = 0;
  hallOfFame: Object = {}; // archived stuff

  // collections of feeds available and selected
  selectedFeeds: Object = { 'NewZeeTutorial': true }; // set the tutorial as default to true
  defaultFeeds: Array<Object> = [];
  customFeeds: Array<Object> = [];
  feedIndexCounter: number = 0;
  debuginfo: string = "";

  // statistics
  //  feedStatistics: Object = {};

  // overall app settings  
  appSettings: Object = {
    'maxAge': 2,
    'maxItemsInView': 150,
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
  //  isReading: boolean = false; // is the user scrolling? we cannot add to the list then
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

    //this.storage.clear();
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
      this.newsData[hashcode]['favorite'] = !this.newsData[hashcode]['favorite'];
      if (this.newsData[hashcode]['favorite']) {
        this.hallOfFame[hashcode] = data['item'];
      }
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

    this.newsData[item['hashcode']]['favorite'] = !this.newsData[item['hashcode']]['favorite'];

    if (this.newsData[item['hashcode']]['favorite']) this.hallOfFame[item['hashcode']] = item;
  }

  doSocialShare(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();

    if (typeof window.plugins !== 'undefined')
      this.socialSharing.share("", item['description'], [], item['link']);
  }

  deleteItem(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();
    this.deleteNewsItem(item['hashcode']);
  }

  deleteFeed(item, slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();

    // remove all items with the same label
    let feedlabel = item['feedlabel'];
    for (var i = this.newsIndex.length - 1; i >= 0; i--) {
      let hashcode = this.newsIndex[i];
      if (this.newsData[hashcode]['feedlabel'] == feedlabel)
        if (!this.newsData[hashcode]['favorite'])
          this.deleteNewsItem(hashcode);
    }

    // remove from the settings
    this.selectedFeeds[item['feedlabel']] = false;
    this.newsservice.setActiveServices(this.selectedFeeds);

    // save the stuff
    this.saveSettingsAndData();
  }

  fabContainerClick() {
    this.lastUserAction = Date.now();
    //  this.isReading = true;
  }

  startScrolling() {
    //this.isReading = true;
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
   * Does a full refresh of all newsfeeds
   * 
   */
  doPushRefresh(fab?) {
    if ((fab !== null) && (typeof fab !== 'undefined')) fab.close();
    //  this.showLoading(this.appSettings['refreshTime']);
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
    for (var i = this.newsIndex.length - 1; i >= 0; i--) {

      let hashcode = this.newsIndex[i];

      if (!this.newsData[hashcode]['favorite']) {
        this.newsData[hashcode]['seen'] = true;
        this.deleteNewsItem(hashcode);
      }
    }

    // check the buffer and add to the view what is possible
    /* if (this.newsBuffer.length > 0) {
       this.appSettings['maxItemsInView']
 
 
 
       let cachelength = this.newsIndex.length;
       this.debuglog('START stuff ' + this.newsIndex.length + ' ' + this.newsBuffer.length + ' ' + cachelength);
 
       console.log('SUTFFFF1', this.newsIndex, this.newsBuffer, cachelength);
 
       this.newsIndex = this.newsIndex
         .concat(
         this.newsBuffer
           .slice(0, this.appSettings['maxItemsInView'] - cachelength)
         );
 
       this.newsBuffer = this.newsBuffer.slice(cachelength);
 
       this.itemCount = this.newsIndex.length;
 
       this.fillView();
 
       console.log('SUTFFFF2', this.newsIndex, this.newsBuffer, cachelength);
 
       this.debuglog('END stuff ' + this.newsIndex.length + ' ' + this.newsBuffer.length + ' ' + cachelength);
     }
 */


    this.saveSettingsAndData();
    this.isLoading = false;
    //this.isReading = false;

    // go to top
    this.scrollToTop();
  }

  // Handling of new pages

  showHallOfFame(slider) {
    if ((slider !== null) && (typeof slider !== 'undefined')) slider.close();

    // show the page and we pass quite some data .... 
    let popover = this.modalCtrl.create(HallOfFamePage, {
      hallOfFame: this.hallOfFame
    }, { enableBackdropDismiss: true });
    popover.present();
  }


  /**
   * Show the feedselector page
   * 
   * @param {FabContainer} fab - The reference to the FAB Container which it needs to close
   */
  showFeedSelector(fab?: FabContainer) {

    // close the fab container list
    if ((fab !== null) && (typeof fab !== 'undefined')) fab.close();

    // disable view updates
    //this.isReading = false;

    // show the page and we pass quite some data .... 
    let modal = this.modalCtrl.create(FeedselectorPage, {
      defaultFeeds: this.defaultFeeds,
      customFeeds: this.customFeeds,
      selectedFeeds: this.selectedFeeds,
      appSettings: this.appSettings,
      feedStatistics: {}, //this.feedStatistics,
      model: {},
      hallOfFame: this.hallOfFame
    }, { enableBackdropDismiss: true });

    modal.present();

    // handler for the action once the settings is closed
    modal.onDidDismiss((value) => {

      // place the settings if we did receive anything (backdrop delivers undefined, ESC press null)
      if ((typeof value !== 'undefined') && (value !== null)) {

        // store the setting in the app
        this.selectedFeeds = value.selectedFeeds;
        this.customFeeds = value.customFeeds;

        this.newsservice.setFeeds(this.defaultFeeds.concat(this.customFeeds));
        this.newsservice.setActiveServices(this.selectedFeeds);

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
      //this.isReading = true;

      // tslint message avoid
      let browser;
      browser = this.iab.create(item['link'], '_system'); // avoid tslint issue
      browser.show();

      // statistics
      /*
      let label = item['feedlabel'];
      if (typeof this.feedStatistics[label] === 'undefined') {
        this.feedStatistics[label] = {};
        this.feedStatistics[label]['article count'] = 0;
        this.feedStatistics[label]['relevance'] = 0;
        this.feedStatistics[label]['feedlabel'] = label;
        this.feedStatistics[label]['clicks'] = 0;
        this.feedStatistics[label]['deeplinks'] = 0;
        this.feedStatistics[label]['last pub'] = 0;
      }
      this.feedStatistics[label]['deeplinks'] = this.feedStatistics[label]['deeplinks']['deeplinks'] + 1;
      */
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
      //this.isReading = true;

      // create the popover
      let popover = this.popoverCtrl
        .create(NewsPopoverPage, { data: item }, { enableBackdropDismiss: true });

      // statistics - not very dry
      /*
      let label = item['feedlabel'];
      if (typeof this.feedStatistics[label] === 'undefined') {
        this.feedStatistics[label] = {};
        this.feedStatistics[label]['article count'] = 0;
        this.feedStatistics[label]['relevance'] = 0;
        this.feedStatistics[label]['feedlabel'] = label;
        this.feedStatistics[label]['clicks'] = 0;
        this.feedStatistics[label]['deeplinks'] = 0;
      }
      this.feedStatistics[label]['clicks'] = this.feedStatistics[label]['clicks'] + 1;
*/
      // present the popover, no event passed, so it will be centered
      popover.present({});
    }
  }

  // Other internal stuff
  doRefresh() {

    this.debuginfo = "";

    //    console.log('SDADSDSAD',Observable.of(5,8,7,9,1,0,6,6,5).toArray().map(arr=>arr.sort()).subscribe(x=>console.log(x)));


    // allow for full loading, only if loading is not already in progress
    if (!this.isLoading) {
      // this.isReading = false;
      this.isLoading = true;
      this.newsservice.setLoading(true);


      // load the feeds
      this.newsSubscription = this.newsservice.doFullRefresh()
        .filter((item) => {

          // we are going to add this item, unless otherwise is defined below
          let additem = true;
          let hashcode = item['hashcode'];

          // is the item already in the database? e.g. seen??
          //if (typeof this.newsData[hashcode] !== 'undefined') additem = false;
          if (this.seenItems.indexOf(hashcode) > -1) additem = false;

          // check the date
          if ((Date.now() - item['pubTime']) > (this.appSettings['maxAge'] * 24 * 60 * 60 * 1000))
            additem = false;

          return additem;
        })
        .toArray()
        .subscribe(
        (item) => {
          console.log('DOING ', item);
          //
          this.loadedItems = item;
        },
        (item) => {
          console.log('DONE', item);
          this.events.publish('progress', { 'value': 0, 'total': 1, 'text': '' });
          this.fillView();
        },
        (item) => {
          console.log('ERROR ', item);
          this.events.publish('progress', { 'value': 0, 'total': 1, 'text': '' });
          this.fillView();
        }
        )
      /*
      .subscribe(
      (item) => {
        this.addNewsItem(item);
        this.debuglog('.');
      },
      (error) => {
        this.isLoading = false;
        this.debuglog('error' + JSON.stringify(error));
        console.log('ERROR 447', error);
        this.events.publish('progress', { 'value': 0, 'total': 1, 'text': '' });
      },
      () => {
        //          console.log('done');
        //   if (!this.isReading) this.fillView();
        this.isLoading = false;
        this.events.publish('progress', { 'value': 0, 'total': 1, 'text': '' });

        // done loading, sort the stuff
        this.fillView();
      });
      */
    }
  }

  deleteNewsItem(hashcode) {
    if (this.seenItems.indexOf(hashcode) < 0)
      this.seenItems.push(hashcode);

    delete (this.newsData[hashcode]);

    this.newsIndex.splice(this.newsIndex.indexOf(hashcode), 1);
    this.itemCount--;
  }

  addNewsItem(item) {
    let hashcode = item['hashcode'];

    console.log('SKAJDSLAJDS', item, this.appSettings['maxItemsInView'], this.newsData, this.newsIndex.length, this.itemCount);

    // we have a new item
    if (this.newsIndex.length < this.appSettings['maxItemsInView']) {
      if (!this.newsData[hashcode]) {
        this.newsIndex.push(hashcode);
        this.newsData[hashcode] = Object.assign(
          {
            favorite: false,
            seen: false
          }, item);
        this.itemCount++;

        this.loadedItems.push(item);
      }
    }
    /*
    else {
      this.newsData[hashcode] = Object.assign(
        {
          favorite: false,
          seen: false
        }, item);

      // sort if the max was reached
      if (this.newsIndex.length == (this.appSettings['maxItemsInView'] + 1)) this.fillView();

      this.newsBuffer.push(hashcode);
    }
    */
  }

  fillView() {


    //    console.log('LOADED items pre', this.loadedItems);
    this.loadedItems.sort(
      (a, b) => {
        // console.log('SORT',a,b);
        if (a['pubTime'] > b['pubTime']) {
          return -1;
        }
        if (a['pubTime'] < b['pubTime']) {
          return 1;
        }
        return 0;
      }
    )
    //    console.log('LOADED items post', this.loadedItems);

    this.itemCount = this.loadedItems.length;
    /*
        if (this.appSettings['sortdate']) {
          this.newsIndex.sort(
            (a, b) => {
              if (this.newsData[a]['pubTime'] > this.newsData[b]['pubTime']) {
                return -1;
              }
              if (this.newsData[a]['pubTime'] < this.newsData[b]['pubTime']) {
                return 1;
              }
              return 0;
            }
          )
        }
    
        if (!this.appSettings['sortdate']) {
          console.log('sorting', this.appSettings['sortdate']);
          this.newsIndex.sort(
            (a, b) => {
              if (this.newsData[a]['feedlabel'] < this.newsData[b]['feedlabel']) {
                return -1;
              }
              if (this.newsData[a]['feedlabel'] > this.newsData[b]['feedlabel']) {
                return 1;
              }
              return 0;
            }
          );
        }
    */

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

  /**
   * Adds item to the list of newsitems, in a sorted manner
   * 
   * Holds the main page for the news reader 
   * @param {Object} item - The news item (untyped) according to the layout in top of this file
   */
  addItemToLabelStatistics(item) {
    // statics
    /*
    let label = item['feedlabel'];
    if (typeof this.feedStatistics[label] === 'undefined') {
      this.feedStatistics[label] = {};
      this.feedStatistics[label]['article count'] = 0;
      this.feedStatistics[label]['relevance'] = 0;
      this.feedStatistics[label]['feedlabel'] = label;
      this.feedStatistics[label]['clicks'] = 0;
      this.feedStatistics[label]['deeplinks'] = 0;
      this.feedStatistics[label]['last pub'] = 0;
    }

    // update the stats
    this.feedStatistics[label]['article count'] = this.feedStatistics[label]['article count'] + 1;
    this.feedStatistics[label]['relevance'] = this.feedStatistics[label]['relevance'] + item['relevance'];
    if (item['pubTime'] > this.feedStatistics[label]['last pub'])
      this.feedStatistics[label]['last pub'] = item['pubTime'];
      */
  }

  debuglog(s) {
    this.debuginfo = this.debuginfo + '\n\n' + s;
  }

  saveSettingsAndData() {
    this.debuglog('DEBUG saving data');

    // clear seen items but make sure not too many are stored
    if (this.seenItems.length > 1000)
      this.seenItems = this.seenItems.slice(-700);
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

    // save all the news data, first clean it though (old items)
    let now = Date.now();
    Object.keys(this.newsData)
      .filter(hashcode => { return this.newsData[hashcode]['seen'] })
      .filter(hashcode => { return (now - this.newsData[hashcode]['pubTime']) > this.appSettings['maxAge'] * 24 * 60 * 60 * 1000 })
      .map(hashcode => { delete this.newsData[hashcode]; });
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
          //this.debuglog('DEBUG loaded appsettings ' + JSON.stringify(this.appSettings));

          //  this.debug.setLogging(this.appSettings['debug']);
          //this.debug.setToastLogging(this.appSettings['toastdebug']);
          //  this.debug.setToastLogging(false);
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
          this.seenItems = val; //[]; //val; override 

          this.seenItems.map(hashcode => {
            this.newsData[hashcode] = {};
            this.newsData[hashcode]['seen'] = true;
          });
          this.debuglog('SEEN ITEMS COUNT :' + this.seenItems.length.toString());
        }
      })
      .catch(err => { this.debuglog('ERROR seenitems' + JSON.stringify(err)) })

    // load the statistics
    this.db.getkey('feedStatistics').then(
      (val) => {
        this.debuglog('DEBUG stat type ' + typeof val);
        //        if (val != null)
        //        this.feedStatistics = {} // val;
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
            //            this.showFeedSelector();
          } else {
            this.selectedFeeds = val;
            this.newsservice.setActiveServices(val);
          }
        }
      })
      .catch(err => { this.debuglog('ERROR sf' + JSON.stringify(err)) })

    // configure the feeds, need to save settings of deleted feeds (FUTURE)
    this.http.get('assets/newsfeeds.json')
      .map(res => res.json())
      .subscribe(res => {
        this.newsservice.setFeeds(res);
        this.defaultFeeds = res;

        //  any feeds custom added
        this.db.getkey('customFeeds').then(
          (val) => {
            if (val != null)
              this.customFeeds = val;

            this.debuglog('Loaded custom feeds');

            this.newsservice.setFeeds(this.defaultFeeds.concat(this.customFeeds));
          });
      })
  }
}