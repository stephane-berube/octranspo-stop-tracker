<?php

// TODO: Abstract, probably
class Api {
    protected $prefix = '';
    protected $dailyLimit = 0;
    protected $last_time_we_accessed_api;
    protected $nb_requests_made_today;

    public function __construct() {
        $this->last_time_we_accessed_api = apcu_fetch($this->prefix . 'last_time_we_accessed_api') ?: null;
        $this->nb_requests_made_today = apcu_fetch($this->prefix . 'nb_requests_made_today') ?: 0;

        // Reset counter if last time we fetch from api wasn't today
        // or if we don't know when the last time API was accessed
        if ($this->last_time_we_accessed_api === null || !$this->is_today($this->last_time_we_accessed_api)) {
            $this->setProp('nb_requests_made_today', 0);
        }
    }

    // TODO: Utils
    public function is_today($timestamp) {
        return date('Ymd') === date('Ymd', $timestamp);
    }

    public function apiCallsRemainingToday() {
        return $this->dailyLimit - $this->nb_requests_made_today;
    }

    public function isWaitTimeExpired() {
        $last = $this->last_time_we_accessed_api;
        $waitTime = $this->waitTime();

        return ($waitTime + $last < time());
    }

    public function waitTime() {
        $api_connections_left_today = $this->apiCallsRemainingToday();
        $seconds_left_before_midnight = strtotime('tomorrow') - time();

        return max( ($seconds_left_before_midnight / $api_connections_left_today), 1 );
    }

    public function setProp($propName, $value) {
        apcu_store($this->prefix . $propName, $value);
        $this->$propName = $value;
    }
}

