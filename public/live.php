<?php

require_once('../classes/Octranspo.php');

$config = json_decode(file_get_contents('../config.json'));

// OCTranspo creds
$appId = $config->octranspo->appId;
$apiKey = $config->octranspo->apiKey;
$busNo = $config->octranspo->busNo;
$stopNo = $config->octranspo->stopNo;

$ocTranspo = new OCTranspo($appId, $apiKey);

$nextTrips = $ocTranspo->getNextTrips($stopNo, $busNo);

header('Content-Type: application/json');

echo $nextTrips;

