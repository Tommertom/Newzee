# .Newzee smart and easy Newsreader
.Newzee is a simple and smart newsreader which takes feeds from popular sources
and allows the user to swiftly browse through the newsitems.

Some of the features are:
* set/unset favorite items - these will stay on the list until you unfavorite or swipe
* easy selection of feeds per topic and on the fly unsubscribe if needed
* direct deeplinking - if you press and hold an item, you will directly go to the article on the web
* many newsservices which you can easily select and unselect
* social sharing of news


## Todo
* more feeds, more feeds, more feeds... but only good ones 
* statistics 
* work on the HTTP headers for optimisation

Some known issues:
* code cleaning and sanitise for security (injecting of code)
* feed selector runs very slow
* lazy loading images a bit flawed (ionic issue?)

## Future...
* Hall of Fame sharing on website (Firebase experiment)
* Following hall of fame of others
* Code optimisation possible
* Other optimisations on feed loading
* Difficult feeds: Youtube, Facebook....

## Getting Started
* Install Node.JS and npm (https://nodejs.org/en/download/), as well as git (https://git-scm.com/downloads)
* Clone this repository: `git clone https://github.com/Tommertom/Newzee.git`.
* Run `npm install` from the project root.
* Install the ionic CLI, Cordova (`npm install -g ionic@latest cordova@latest`)
* Run `ionic serve` to have the project compiled for the first time 

Needs cordova plugins (after full install and compile):
* `ionic cordova platform add android` (or iOS) - will also install plugins below:
* `ionic cordova plugin add --save cordova-plugin-inappbrowser` 
* `ionic cordova  plugin add --save cordova-plugin-x-socialsharing`
* `ionic cordova plugin add --save cordova-sqlite-storage `

This demo is available in Ionic View (similar to Apple's Testflight) under app ID `e141e4d5`. Download Ionic View (legacy version) in your app store (android/iOS), register free 
Ionic account (https://apps.ionic.io/signup) and enjoy. Assure you do a `Clear App Data` in Ionic View
if you want to enjoy the latest committed version.  NOTE: some of the feeds are not working in `ionic serve` due to CORS restrictions

## Important!
Use at own discretion, but if you have any suggestion, let me know or do a PR. 

(C) 2017 Tommertom - github.com/Tommertom/Newzee

Provided under Apache2 License.

## Screenshots
![Overview](https://raw.githubusercontent.com/Tommertom/newsapp/master/screenshots/IMG_4723.PNG)
![Popup](https://raw.githubusercontent.com/Tommertom/newsapp/master/screenshots/IMG_4724.PNG)
![Loading](https://raw.githubusercontent.com/Tommertom/newsapp/master/screenshots/IMG_4726.PNG)
![Settings](https://raw.githubusercontent.com/Tommertom/newsapp/master/screenshots/IMG_4720.PNG)
![Done](https://raw.githubusercontent.com/Tommertom/newsapp/master/screenshots/IMG_4721.PNG)


