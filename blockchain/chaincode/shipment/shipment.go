package main

import (
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

const (
	ShipperMSP = "ShipperMSP"
	CarrierMSP = "CarrierMSP"
	CustomsMSP = "CustomsMSP"
)

type SmartContract struct {
	contractapi.Contract
}

type Shipment struct {
	ShipmentID       string          `json:"shipmentId"`
	ContainerID      string          `json:"containerId"`
	Origin           string          `json:"origin"`
	Destination      string          `json:"destination"`
	Carrier          string          `json:"carrier"`
	Shipper          string          `json:"shipper"`
	CurrentHolder    string          `json:"currentHolder"`
	Status           ShipmentStatus  `json:"status"`
	Events           []ShipmentEvent `json:"events"`
	CargoType        string          `json:"cargoType"`
	WeightKg         float64         `json:"weightKg"`
	CreatedAt        string          `json:"createdAt"`
	EstimatedArrival string          `json:"estimatedArrival"`
	ActualArrival    string          `json:"actualArrival"`
	DelayRiskScore   float64         `json:"delayRiskScore"`
}

type ShipmentStatus string

const (
	StatusCreated   ShipmentStatus = "CREATED"
	StatusInTransit ShipmentStatus = "IN_TRANSIT"
	StatusAtPort    ShipmentStatus = "AT_PORT"
	StatusInCustoms ShipmentStatus = "IN_CUSTOMS"
	StatusDelivered ShipmentStatus = "DELIVERED"
	StatusDelayed   ShipmentStatus = "DELAYED"
)

type ShipmentEvent struct {
	EventID     string `json:"eventId"`
	EventType   string `json:"eventType"`
	Location    string `json:"location"`
	Actor       string `json:"actor"`
	Timestamp   string `json:"timestamp"`
	Description string `json:"description"`
	TxID        string `json:"txId"`
}

func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	shipments := []Shipment{
		{
			ShipmentID:       "SHP-001",
			ContainerID:      "CONT-ABC123",
			Origin:           "Shanghai, CN",
			Destination:      "Rotterdam, NL",
			Carrier:          "OceanFreight Co",
			Shipper:          ShipperMSP,
			CurrentHolder:    CarrierMSP,
			Status:           StatusInTransit,
			CargoType:        "Electronics",
			WeightKg:         12500,
			CreatedAt:        "2024-01-15T08:00:00Z",
			EstimatedArrival: "2024-02-10T00:00:00Z",
			ActualArrival:    "",
			DelayRiskScore:   0.32,
			Events: []ShipmentEvent{
				{
					EventID:     "EVT-001-1",
					EventType:   "SHIPMENT_CREATED",
					Location:    "Shanghai, CN",
					Actor:       ShipperMSP,
					Timestamp:   "2024-01-15T08:00:00Z",
					Description: "Shipment created by shipper",
					TxID:        "tx_init_001",
				},
				{
					EventID:     "EVT-001-2",
					EventType:   "DEPARTED_PORT",
					Location:    "Shanghai Port",
					Actor:       CarrierMSP,
					Timestamp:   "2024-01-16T10:00:00Z",
					Description: "Carrier departed origin port",
					TxID:        "tx_init_002",
				},
			},
		},
		{
			ShipmentID:       "SHP-002",
			ContainerID:      "CONT-XYZ789",
			Origin:           "Mumbai, IN",
			Destination:      "Felixstowe, UK",
			Carrier:          "GlobalShip Ltd",
			Shipper:          ShipperMSP,
			CurrentHolder:    CustomsMSP,
			Status:           StatusInCustoms,
			CargoType:        "Textiles",
			WeightKg:         8200,
			CreatedAt:        "2024-01-20T10:00:00Z",
			EstimatedArrival: "2024-02-25T00:00:00Z",
			ActualArrival:    "",
			DelayRiskScore:   0.71,
			Events: []ShipmentEvent{
				{
					EventID:     "EVT-002-1",
					EventType:   "SHIPMENT_CREATED",
					Location:    "Mumbai, IN",
					Actor:       ShipperMSP,
					Timestamp:   "2024-01-20T10:00:00Z",
					Description: "Shipment created by shipper",
					TxID:        "tx_init_003",
				},
				{
					EventID:     "EVT-002-2",
					EventType:   "ARRIVED_PORT",
					Location:    "Felixstowe, UK",
					Actor:       CarrierMSP,
					Timestamp:   "2024-02-22T14:30:00Z",
					Description: "Carrier arrived at destination port",
					TxID:        "tx_init_004",
				},
				{
					EventID:     "EVT-002-3",
					EventType:   "CUSTOMS_ENTRY",
					Location:    "Felixstowe, UK",
					Actor:       CustomsMSP,
					Timestamp:   "2024-02-22T16:00:00Z",
					Description: "Shipment entered customs verification",
					TxID:        "tx_init_005",
				},
			},
		},
	}

	for _, shipment := range shipments {
		shipmentJSON, err := json.Marshal(shipment)
		if err != nil {
			return fmt.Errorf("failed to marshal shipment %s: %v", shipment.ShipmentID, err)
		}
		if err := ctx.GetStub().PutState(shipment.ShipmentID, shipmentJSON); err != nil {
			return fmt.Errorf("failed to write shipment %s to ledger: %v", shipment.ShipmentID, err)
		}
	}

	return nil
}

func (s *SmartContract) CreateShipment(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
	containerID string,
	origin string,
	destination string,
	carrier string,
	cargoType string,
	weightKg float64,
	estimatedArrival string,
) (*Shipment, error) {
	clientOrg, err := s.requireOrg(ctx, ShipperMSP)
	if err != nil {
		return nil, err
	}

	existing, err := ctx.GetStub().GetState(shipmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to read ledger: %v", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("shipment %s already exists", shipmentID)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	shipment := Shipment{
		ShipmentID:       shipmentID,
		ContainerID:      containerID,
		Origin:           origin,
		Destination:      destination,
		Carrier:          carrier,
		Shipper:          clientOrg,
		CurrentHolder:    ShipperMSP,
		Status:           StatusCreated,
		CargoType:        cargoType,
		WeightKg:         weightKg,
		CreatedAt:        now,
		EstimatedArrival: estimatedArrival,
		ActualArrival:    "",
		DelayRiskScore:   0,
		Events: []ShipmentEvent{
			s.newEvent(ctx, shipmentID, 1, "SHIPMENT_CREATED", origin, clientOrg, now, fmt.Sprintf("Shipment created. Container %s ready at %s", containerID, origin)),
		},
	}

	shipmentJSON, err := json.Marshal(shipment)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal shipment: %v", err)
	}
	if err := ctx.GetStub().PutState(shipmentID, shipmentJSON); err != nil {
		return nil, fmt.Errorf("failed to write shipment to ledger: %v", err)
	}

	if err := ctx.GetStub().SetEvent("ShipmentCreated", shipmentJSON); err != nil {
		return nil, fmt.Errorf("failed to emit ShipmentCreated event: %v", err)
	}

	return &shipment, nil
}

func (s *SmartContract) RecordEvent(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
	eventType string,
	location string,
	description string,
) (*Shipment, error) {
	shipment, err := s.getShipment(ctx, shipmentID)
	if err != nil {
		return nil, err
	}

	clientOrg, err := s.getClientOrg(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.authorizeEvent(clientOrg, eventType); err != nil {
		return nil, err
	}
	if err := s.validateEventFlow(shipment, eventType); err != nil {
		return nil, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	shipment.Events = append(shipment.Events, s.newEvent(ctx, shipmentID, len(shipment.Events)+1, eventType, location, clientOrg, now, description))
	shipment.Status = s.deriveStatus(eventType, shipment.Status)

	if eventType == "CUSTOMS_ENTRY" {
		shipment.CurrentHolder = CustomsMSP
	}

	return s.saveShipment(ctx, shipment)
}

func (s *SmartContract) TransferCustody(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
	newHolder string,
	location string,
) (*Shipment, error) {
	shipment, err := s.getShipment(ctx, shipmentID)
	if err != nil {
		return nil, err
	}

	clientOrg, err := s.getClientOrg(ctx)
	if err != nil {
		return nil, err
	}
	if shipment.CurrentHolder != clientOrg {
		return nil, fmt.Errorf("only current holder %s can transfer custody, caller is %s", shipment.CurrentHolder, clientOrg)
	}
	if !isLogisticsOrg(newHolder) {
		return nil, fmt.Errorf("invalid custody holder %s", newHolder)
	}
	if err := s.validateCustodyTransfer(clientOrg, newHolder); err != nil {
		return nil, err
	}

	previousHolder := shipment.CurrentHolder
	shipment.CurrentHolder = newHolder
	now := time.Now().UTC().Format(time.RFC3339)
	shipment.Events = append(shipment.Events, s.newEvent(
		ctx,
		shipmentID,
		len(shipment.Events)+1,
		"CUSTODY_TRANSFERRED",
		location,
		clientOrg,
		now,
		fmt.Sprintf("Custody transferred from %s to %s at %s", previousHolder, newHolder, location),
	))

	return s.saveShipment(ctx, shipment)
}

func (s *SmartContract) UpdateDelayRisk(ctx contractapi.TransactionContextInterface, shipmentID string, riskScore float64) (*Shipment, error) {
	if _, err := s.requireAnyOrg(ctx, ShipperMSP, CarrierMSP, CustomsMSP); err != nil {
		return nil, err
	}

	shipment, err := s.getShipment(ctx, shipmentID)
	if err != nil {
		return nil, err
	}

	shipment.DelayRiskScore = riskScore
	if riskScore >= 0.85 && shipment.Status == StatusInTransit {
		shipment.Status = StatusDelayed
	}

	return s.saveShipment(ctx, shipment)
}

func (s *SmartContract) MarkDelivered(ctx contractapi.TransactionContextInterface, shipmentID string) (*Shipment, error) {
	clientOrg, err := s.requireOrg(ctx, CustomsMSP)
	if err != nil {
		return nil, err
	}

	shipment, err := s.getShipment(ctx, shipmentID)
	if err != nil {
		return nil, err
	}
	if !s.hasEvent(shipment, "CUSTOMS_CLEARED") {
		return nil, fmt.Errorf("customs must clear shipment before delivery")
	}

	shipment.Status = StatusDelivered
	shipment.ActualArrival = time.Now().UTC().Format(time.RFC3339)
	shipment.CurrentHolder = CustomsMSP
	shipment.Events = append(shipment.Events, s.newEvent(
		ctx,
		shipmentID,
		len(shipment.Events)+1,
		"DELIVERED",
		shipment.Destination,
		clientOrg,
		shipment.ActualArrival,
		fmt.Sprintf("Shipment delivered to %s after customs clearance", shipment.Destination),
	))

	return s.saveShipment(ctx, shipment)
}

func (s *SmartContract) UpdateStatus(ctx contractapi.TransactionContextInterface, shipmentID string, newStatus string, reason string) (*Shipment, error) {
	clientOrg, err := s.getClientOrg(ctx)
	if err != nil {
		return nil, err
	}

	status, err := parseStatus(newStatus)
	if err != nil {
		return nil, err
	}
	if err := s.authorizeStatusUpdate(clientOrg, status); err != nil {
		return nil, err
	}

	shipment, err := s.getShipment(ctx, shipmentID)
	if err != nil {
		return nil, err
	}

	if status == StatusDelivered && !s.hasEvent(shipment, "CUSTOMS_CLEARED") {
		return nil, fmt.Errorf("customs must clear shipment before delivery")
	}

	oldStatus := string(shipment.Status)
	shipment.Status = status
	now := time.Now().UTC().Format(time.RFC3339)
	shipment.Events = append(shipment.Events, s.newEvent(
		ctx,
		shipmentID,
		len(shipment.Events)+1,
		"STATUS_UPDATED",
		"N/A",
		clientOrg,
		now,
		fmt.Sprintf("Status changed from %s to %s. Reason: %s", oldStatus, newStatus, reason),
	))

	return s.saveShipment(ctx, shipment)
}

func (s *SmartContract) VerifyIntegrity(ctx contractapi.TransactionContextInterface, shipmentID string, claimedDataJSON string) (map[string]interface{}, error) {
	if _, err := s.requireOrg(ctx, CustomsMSP); err != nil {
		return nil, err
	}

	onChainJSON, err := ctx.GetStub().GetState(shipmentID)
	if err != nil || onChainJSON == nil {
		return nil, fmt.Errorf("shipment %s not found", shipmentID)
	}

	isMatch := string(onChainJSON) == claimedDataJSON
	message := "INTEGRITY VERIFIED - data matches ledger exactly"
	if !isMatch {
		message = "INTEGRITY FAILED - data has been tampered with or modified"
	}

	return map[string]interface{}{
		"shipmentId":    shipmentID,
		"integrityPass": isMatch,
		"verifiedAt":    time.Now().UTC().Format(time.RFC3339),
		"txId":          ctx.GetStub().GetTxID(),
		"message":       message,
	}, nil
}

func (s *SmartContract) GetShipment(ctx contractapi.TransactionContextInterface, shipmentID string) (*Shipment, error) {
	return s.getShipment(ctx, shipmentID)
}

func (s *SmartContract) GetAllShipments(ctx contractapi.TransactionContextInterface) ([]*Shipment, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get all shipments: %v", err)
	}
	defer resultsIterator.Close()

	var shipments []*Shipment
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var shipment Shipment
		if err := json.Unmarshal(queryResponse.Value, &shipment); err != nil {
			return nil, err
		}
		shipments = append(shipments, &shipment)
	}

	sort.Slice(shipments, func(i, j int) bool {
		return shipments[i].ShipmentID < shipments[j].ShipmentID
	})

	return shipments, nil
}

func (s *SmartContract) GetShipmentHistory(ctx contractapi.TransactionContextInterface, shipmentID string) ([]map[string]interface{}, error) {
	historyIterator, err := ctx.GetStub().GetHistoryForKey(shipmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get history for %s: %v", shipmentID, err)
	}
	defer historyIterator.Close()

	var history []map[string]interface{}
	for historyIterator.HasNext() {
		modification, err := historyIterator.Next()
		if err != nil {
			return nil, err
		}

		entry := map[string]interface{}{
			"txId":      modification.TxId,
			"timestamp": modification.Timestamp,
			"isDelete":  modification.IsDelete,
		}

		if !modification.IsDelete {
			var shipment Shipment
			if err := json.Unmarshal(modification.Value, &shipment); err == nil {
				entry["value"] = shipment
			}
		}

		history = append(history, entry)
	}

	return history, nil
}

func (s *SmartContract) getShipment(ctx contractapi.TransactionContextInterface, shipmentID string) (*Shipment, error) {
	shipmentJSON, err := ctx.GetStub().GetState(shipmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to read shipment %s: %v", shipmentID, err)
	}
	if shipmentJSON == nil {
		return nil, fmt.Errorf("shipment %s does not exist", shipmentID)
	}

	var shipment Shipment
	if err := json.Unmarshal(shipmentJSON, &shipment); err != nil {
		return nil, fmt.Errorf("failed to unmarshal shipment: %v", err)
	}

	return &shipment, nil
}

func (s *SmartContract) saveShipment(ctx contractapi.TransactionContextInterface, shipment *Shipment) (*Shipment, error) {
	shipmentJSON, err := json.Marshal(shipment)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal shipment: %v", err)
	}
	if err := ctx.GetStub().PutState(shipment.ShipmentID, shipmentJSON); err != nil {
		return nil, fmt.Errorf("failed to save shipment: %v", err)
	}
	return shipment, nil
}

func (s *SmartContract) getClientOrg(ctx contractapi.TransactionContextInterface) (string, error) {
	clientOrg, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return "", fmt.Errorf("failed to get client identity: %v", err)
	}
	return clientOrg, nil
}

func (s *SmartContract) requireOrg(ctx contractapi.TransactionContextInterface, expected string) (string, error) {
	clientOrg, err := s.getClientOrg(ctx)
	if err != nil {
		return "", err
	}
	if clientOrg != expected {
		return "", fmt.Errorf("only %s can perform this action, caller is %s", expected, clientOrg)
	}
	return clientOrg, nil
}

func (s *SmartContract) requireAnyOrg(ctx contractapi.TransactionContextInterface, allowed ...string) (string, error) {
	clientOrg, err := s.getClientOrg(ctx)
	if err != nil {
		return "", err
	}
	for _, org := range allowed {
		if clientOrg == org {
			return clientOrg, nil
		}
	}
	return "", fmt.Errorf("caller %s is not authorized for this action", clientOrg)
}

func (s *SmartContract) newEvent(ctx contractapi.TransactionContextInterface, shipmentID string, eventNumber int, eventType string, location string, actor string, timestamp string, description string) ShipmentEvent {
	return ShipmentEvent{
		EventID:     fmt.Sprintf("EVT-%s-%d", shipmentID, eventNumber),
		EventType:   eventType,
		Location:    location,
		Actor:       actor,
		Timestamp:   timestamp,
		Description: description,
		TxID:        ctx.GetStub().GetTxID(),
	}
}

func (s *SmartContract) authorizeEvent(clientOrg string, eventType string) error {
	switch eventType {
	case "SHIPMENT_READY":
		if clientOrg == ShipperMSP {
			return nil
		}
	case "DEPARTED_PORT", "ARRIVED_PORT", "DELAY_REPORTED", "CUSTODY_PICKED_UP", "CHECKPOINT_REACHED", "TRANSSHIPMENT":
		if clientOrg == CarrierMSP {
			return nil
		}
	case "CUSTOMS_ENTRY", "CUSTOMS_CLEARED", "CUSTOMS_REJECTED", "INSPECTION":
		if clientOrg == CustomsMSP {
			return nil
		}
	default:
		return fmt.Errorf("unsupported event type %s", eventType)
	}
	return fmt.Errorf("%s cannot record %s", clientOrg, eventType)
}

func (s *SmartContract) validateEventFlow(shipment *Shipment, eventType string) error {
	switch eventType {
	case "DEPARTED_PORT", "ARRIVED_PORT", "DELAY_REPORTED", "CUSTODY_PICKED_UP", "CHECKPOINT_REACHED", "TRANSSHIPMENT":
		if shipment.CurrentHolder != CarrierMSP {
			return fmt.Errorf("carrier cannot record transport event while current holder is %s", shipment.CurrentHolder)
		}
	case "CUSTOMS_ENTRY", "INSPECTION":
		if shipment.CurrentHolder != CustomsMSP {
			return fmt.Errorf("customs cannot verify shipment until custody is transferred to %s", CustomsMSP)
		}
	case "CUSTOMS_CLEARED", "CUSTOMS_REJECTED":
		if !s.hasEvent(shipment, "CUSTOMS_ENTRY") {
			return fmt.Errorf("customs entry must be recorded before %s", eventType)
		}
	}
	return nil
}

func (s *SmartContract) validateCustodyTransfer(from string, to string) error {
	valid := map[string]map[string]bool{
		ShipperMSP: {CarrierMSP: true},
		CarrierMSP: {CustomsMSP: true},
		CustomsMSP: {CarrierMSP: true},
	}
	if valid[from][to] {
		return nil
	}
	return fmt.Errorf("invalid custody transfer from %s to %s", from, to)
}

func (s *SmartContract) authorizeStatusUpdate(clientOrg string, status ShipmentStatus) error {
	switch status {
	case StatusCreated:
		if clientOrg == ShipperMSP {
			return nil
		}
	case StatusInTransit, StatusAtPort, StatusDelayed:
		if clientOrg == CarrierMSP {
			return nil
		}
	case StatusInCustoms, StatusDelivered:
		if clientOrg == CustomsMSP {
			return nil
		}
	}
	return fmt.Errorf("%s cannot set shipment status to %s", clientOrg, status)
}

func (s *SmartContract) deriveStatus(eventType string, current ShipmentStatus) ShipmentStatus {
	switch eventType {
	case "SHIPMENT_READY":
		return StatusCreated
	case "DEPARTED_PORT", "CUSTODY_PICKED_UP", "CHECKPOINT_REACHED", "TRANSSHIPMENT":
		return StatusInTransit
	case "ARRIVED_PORT":
		return StatusAtPort
	case "DELAY_REPORTED":
		return StatusDelayed
	case "CUSTOMS_ENTRY":
		return StatusInCustoms
	case "INSPECTION":
		return StatusInCustoms
	case "CUSTOMS_CLEARED":
		return StatusInCustoms
	case "CUSTOMS_REJECTED":
		return StatusDelayed
	default:
		return current
	}
}

func (s *SmartContract) hasEvent(shipment *Shipment, eventType string) bool {
	for _, event := range shipment.Events {
		if event.EventType == eventType {
			return true
		}
	}
	return false
}

func parseStatus(value string) (ShipmentStatus, error) {
	validStatuses := map[string]ShipmentStatus{
		"CREATED":    StatusCreated,
		"IN_TRANSIT": StatusInTransit,
		"AT_PORT":    StatusAtPort,
		"IN_CUSTOMS": StatusInCustoms,
		"DELIVERED":  StatusDelivered,
		"DELAYED":    StatusDelayed,
	}
	status, ok := validStatuses[value]
	if !ok {
		return "", fmt.Errorf("invalid status '%s'. Valid: CREATED, IN_TRANSIT, AT_PORT, IN_CUSTOMS, DELIVERED, DELAYED", value)
	}
	return status, nil
}

func isLogisticsOrg(org string) bool {
	return org == ShipperMSP || org == CarrierMSP || org == CustomsMSP
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Error creating DLN chaincode: %v\n", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting DLN chaincode: %v\n", err)
	}
}
