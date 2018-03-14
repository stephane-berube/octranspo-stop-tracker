/**
 * Map, live tracking
 */
( function() {
    "use strict";

    var map, busStopIcon, updateBusMarkers, busStopLocation,
        busMarkers = [], busIcons = [], busStopMarker,
        audio = new Audio( "../ping.ogg" );

    map = L.map( "map", {
        center: [ 45.2449019, -75.7364839 ],
        zoom: 18,
        zoomControl: false
    } );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "&copy; <a href='http://osm.org/copyright'>OpenStreetMap</a> contributors"
        }
    ).addTo( map );

    L.AwesomeMarkers.Icon.prototype.options.prefix = "ion";

    /*
     * Bus stop
     */
    busStopIcon = L.AwesomeMarkers.icon( {
        icon: "ios-location",
        markerColor: "red"
    } );

    busStopLocation = new L.LatLng( 45.24501, -75.73672 );
    busStopMarker = L.marker( [ 45.24501, -75.73672 ], { icon: busStopIcon } ).addTo( map );

    /*
     * Bus icons
     */
    busIcons.push( L.AwesomeMarkers.icon( {
        icon: "android-bus",
        markerColor: "orange"
    } ) );

    busIcons.push( L.AwesomeMarkers.icon( {
        icon: "android-bus",
        markerColor: "green"
    } ) );

    busIcons.push( L.AwesomeMarkers.icon( {
        icon: "android-bus",
        markerColor: "blue"
    } ) );

    /*
     * Bus markers
     */
    busMarkers = busIcons.map( ( busIcon ) => {
        return L.marker( [ 0, 0 ], { icon: busIcon } );
    } );

    updateBusMarkers = function() {
        fetch( "/live.php" )
            .then( ( response ) => {
                return response.json();
            } )
            .then( ( coordsArr ) => {
                var activeMarkers = [ busStopMarker ];

                coordsArr.forEach( ( coords, i ) => {
                    var marker = busMarkers[ i ],
                        busLocation,
                        distance;

                    if ( coords.latitude && coords.longitude ) {
                        busLocation = new L.LatLng( coords.latitude, coords.longitude );
                        distance = busLocation.distanceTo( busStopLocation );

                        marker.setLatLng( busLocation );
                        marker.addTo( map );

                        activeMarkers.push( marker );

                        // If the bus is between 800 and 500 meters, play
                        // play audio sound. The > 500 condition is a hack
                        // since we can't flag that we've played the audio
                        // for a particular bus at the moment.
                        // TODO: We could flag a specific bus by catching its
                        //       "TripStartTime", I suppose. We'd need our API
                        //       to return that data along with the coords.
                        if ( distance <= 800 && distance > 500 ) {
                            audio.play();
                        }
                    } else {
                        marker.remove();
                    }
                } );

                map.fitBounds( new L.featureGroup( activeMarkers ).getBounds() );
                setTimeout( updateBusMarkers, 1000 ); // 1s
            } );
    };

    // Kick-off update marker loop
    updateBusMarkers();
}() );

/**
 * Schedule
 */
( function() {
    var updateSchedule,
        container = document.querySelector( ".schedule__times" );

    container.addEventListener( "countdown-expired", ( e ) => {
        var countdownElm = e.target;

        // Apply "expired" styles
        countdownElm
          .closest( ".schedule__item" )
          .classList.add( "schedule__item--expired" );

        // Change wording
        countdownElm
          .closest( ".schedule__time-remaining" )
          .textContent = "(passed)";

        // Remove "countdown" object -- this doesn't affect the DOM
        e.detail.countdown.remove();
    } );

    updateSchedule = function() {
        var rootDocFragment = document.createRange().createContextualFragment( "" );

        fetch( "/times.php" )
            .then( ( response ) => {
                return response.json();
            } )
            .then( ( epochs ) => {
                // TODO: error handling
                epochs.forEach( ( epoch, i ) => {
                    // * 1000 because PHP's strtotime returns seconds
                    // and JS needs milliseconds.
                    // NOTE: We're losing precision. May or may not be an issue.
                    var epochMs = parseInt( epoch, 10 ) * 1000,
                        autoPlay = ( i < 3 ),
                        countdown = new Countdown( epochMs, autoPlay ),
                        dateTime = new Date( epochMs ),
                        isoDateTime = dateTime.toISOString(),
                        time, html, docFragment;

                    // Force Eastern Timezone
                    time = dateTime.toLocaleTimeString(
                        "en-CA",
                        {
                            "timeZone": "America/Toronto",
                            "hour": "2-digit",
                            "minute": "2-digit"
                        }
                    );

                    html = "<li class='schedule__item'>" +
                        "<time class='schedule__time' datetime='" +
                        isoDateTime + "' title='" + isoDateTime + "'>" + time +
                        "</time><br /> <span class='schedule__time-remaining'>" +
                        "(in about <span class='countdown-container'></span>)" +
                        "</span></li>";

                    docFragment = document.createRange().createContextualFragment( html );
                    docFragment.querySelector( ".countdown-container" ).appendChild( countdown.elm );
                    rootDocFragment.appendChild( docFragment );
                } );

                container.appendChild( rootDocFragment );
            } );
    };

    updateSchedule();
}() );

( function() {
    var countdowns = {
            "active": [],
            "inactive": []
        },
        interval = null,
         startInterval, stopInterval;

    startInterval = function() {
        interval = setInterval( () => {
            countdowns.active.forEach( ( countdown ) => {
                countdown.update();
            } );
        }, 1000 );
    };

    stopInterval = function() {
        clearInterval( interval );

        interval = null;
    };

    var Countdown = class Countdown {
        constructor( target, autoPlay ) {
            var elm = document.createElement( "span" ),
                activeCountdowns = countdowns.active,
                shouldAutoPlay = ( autoPlay === undefined || autoPlay === true ); // cast-to-bool

            elm.classList.add( "countdown" );

            this.elm = elm;
            this.target = target;
            this.expired = false;
            this.paused = !shouldAutoPlay; // FIXME: Always set to true and let [1] reset, if needed(?)
            this.events = {
                "expired": new CustomEvent(
                    "countdown-expired",
                    {
                        "detail": {
                            "countdown": this
                        },
                        "bubbles": true
                    }
                )
            };

            // Make sure we have data as soon as possible, otherwise we might
            // have to wait an entire interval cycle before being able to
            // display the countdown
            this.update( true );

            // Default to inactive collection
            countdowns.inactive.push( this );

            // If auto-play, start now. This will move the countdown to the
            // 'active' collection and start the interval, if not already
            // running.
            if ( shouldAutoPlay ) {
                this.play();
            }
        }

        play() {
            var targetCountdown = [];

            countdowns.inactive.every( ( countdown, i ) => {
                if ( this === countdown ) {
                    targetCountdown = countdowns.inactive.splice( i, 1 );

                    return false;
                }
            } );

            if ( targetCountdown.length > 0 ) {
                targetCountdown = targetCountdown[ 0 ];
                targetCountdown.paused = false;
                countdowns.active.push( targetCountdown );
            }

            // Start the interval once we have our first active countdown
            // Make sure we don't have one that's already running for
            // whatever reason.
            if ( countdowns.active.length === 1 && interval === null ) {
                startInterval();
            }
        }

        pause() {
            var targetCountdown = [];

            countdowns.active.every( ( countdown, i ) => {
                if ( this === countdown ) {
                    targetCountdown = countdowns.active.splice( i, 1 );

                    return false;
                }
            } );

            if ( targetCountdown.length > 0 ) {
                targetCountdown = targetCountdown[ 0 ];
                targetCountdown.paused = true;
                countdowns.inactive.push( targetCountdown );
            }

            if ( countdowns.active.length <= 0 ) {
                stopInterval();
            }
        }

        remove() {
            countdowns.active.every( ( countdown, i ) => {
                if ( this === countdown ) {
                    countdowns.active.splice( i, 1 );

                    return false;
                }
            } );

            if ( countdowns.active.length <= 0 ) {
                stopInterval();
            }
        }

        // FIXME: The isInit param is a bit of a hack to ensure we don't
        //        trigger an "expired" event and remove the countdown from the
        //        'active' collection before the countdown is attached to the
        //        DOM (if the countdown `target` is already in the past when
        //        initializing the countdown.
        //
        // TODO:  We may have to create an init() method that's the same as
        //        update(); except don't do the "expire" stuff? Seems redundant
        update( isInit ) {
            var browserTime = new Date(),
                x = Math.floor( ( this.target - browserTime ) / 1000 ),
                seconds, minutes, hours;

            if ( !isInit && this.expired === false && x <= 0 ) {
                this.expired = true;

                this.elm.dispatchEvent( this.events.expired );
            }

            seconds = x % 60;

            x = Math.floor( x / 60 );
            minutes = x % 60;

            x = Math.floor( x / 60 );
            hours = x % 24;

            if ( hours === 0 ) {
                hours = "";

                if ( minutes === 0 ) {
                    minutes = "";
                } else {
                    minutes += "m";
                }
            } else {
                hours += "h";
                minutes += "m";
            }

            this.elm.textContent = hours + minutes + seconds + "s";
        }
    };

    window.Countdown = Countdown;
}() );

