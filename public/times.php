<?php

require_once('../classes/Navitia.php');

$config = json_decode(file_get_contents('../config.json'));

// Navitia creds
$token = $config->navitia->token;
$stopId = $config->navitia->stopId;

$navitia= new Navitia($token);

$nextTrips = $navitia->getStopSchedule($stopId);

header('Content-Type: application/json');

echo $nextTrips;

