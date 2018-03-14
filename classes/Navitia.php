<?php

require_once(dirname(__FILE__) . '/Api.php');

class Navitia extends Api {
    // Cache prefix
    protected $prefix = 'nav-';

    // 3,000 API calls per day
    // The ToS for the free account says 90,000 per month.
    // Let's just say it's 3,000 per day for now (assumes a 30-day month)
    protected $dailyLimit = 3000;

    // Credentials
    protected $token;

    public function __construct($token) {
        parent::__construct();

        $this->token = $token;
    }

    public function getStopSchedule($stopId) {
        if ($this->isWaitTimeExpired()) {
            $last_data_received_from_api = $this->_getStopSchedule($stopId);

            $this->setProp('last_data_received_from_api', $last_data_received_from_api);
            $this->setProp('last_time_we_accessed_api', time());
            $this->setProp('nb_requests_made_today', $this->nb_requests_made_today += 1);
        } else {
            $last_data_received_from_api = apcu_fetch($this->prefix . 'last_data_received_from_api');
        }

        return $last_data_received_from_api;
    }

    private function _getStopSchedule($stopId) {
        // TODO: Error handling
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://" . $this->token . "@api.navitia.io/v1/coverage/ca-on/stop_points/stop_point:" . $stopId  . "/stop_schedules");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        $response = curl_exec($ch);
        curl_close($ch);

        // TODO: Error handling
        $json = json_decode($response);

        $tmp_dateTimes = $json->stop_schedules[0]->date_times;

        $dateTime = array();
        foreach($tmp_dateTimes as $tmp_dateTime) {
            $dateTime[] = strtotime($tmp_dateTime->date_time);
        }

        return json_encode($dateTime);
    }
}

