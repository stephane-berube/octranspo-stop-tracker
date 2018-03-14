<?php

require_once(dirname(__FILE__) . '/Api.php');

class OCTranspo extends Api {
    // Cache prefix
    protected $prefix = 'oc-';

    // 10,000 API calls per day
    // The ToS say 10,000 while the account plan
    // says 20,000. Assume it's 10,000 to be safe.
    protected $dailyLimit = 10000;

    // Credentials
    private $app_id;
    private $api_key;

    public function __construct($appId, $apiKey) {
        parent::__construct();

        $this->app_id = $appId;
        $this->api_key = $apiKey;
    }

    public function getNextTrips($stopNo, $routeNo) {
        if ($this->isWaitTimeExpired()) {
            $last_data_received_from_api = $this->_getNextTrips($stopNo, $routeNo);

            $this->setProp('last_data_received_from_api', $last_data_received_from_api);
            $this->setProp('last_time_we_accessed_api', time());
            $this->setProp('nb_requests_made_today', $this->nb_requests_made_today += 1);
        } else {
            $last_data_received_from_api = apcu_fetch($this->prefix . 'last_data_received_from_api');
        }

        return $last_data_received_from_api;
    }

    private function _getNextTrips($stopNo, $routeNo) {
        $data = [
            'appID' => $this->app_id,
            'apiKey' => $this->api_key,
            'routeNo' => $routeNo,
            'stopNo' => $stopNo
        ];

        // TODO: Error handling
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://api.octranspo1.com/v1.2/GetNextTripsForStop");
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        $response = curl_exec($ch);
        curl_close($ch);

        $coords = $this->parse_xml_response($response);

        return json_encode($coords);
    }

    // TODO: Utils
    private function parse_xml_response($response) {
        $coords = [];

        // TODO: Error handling
        $xmlParser = new SimpleXMLElement($response);
        $xmlParser->registerXPathNamespace('tempuri', 'http://tempuri.org/');
        $trips = $xmlParser->xpath('//tempuri:Trip');

        foreach ($trips as $trip) {
            $coords[] = [
                'longitude' => (string)$trip->Longitude,
                'latitude' => (string)$trip->Latitude
            ];
        }

        return $coords;
    }
}

