package main

import "sync"

type RequestStore struct {
	mu       sync.RWMutex
	requests map[string]*PendingRequest
}

func NewRequestStore() *RequestStore {
	return &RequestStore{
		requests: make(map[string]*PendingRequest),
	}
}

func (s *RequestStore) Add(req *PendingRequest) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.requests[req.ID] = req
}

func (s *RequestStore) Get(id string) (*PendingRequest, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	req, ok := s.requests[id]
	return req, ok
}

func (s *RequestStore) Remove(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.requests, id)
}

func (s *RequestStore) List() []PendingRequestDTO {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var list []PendingRequestDTO
	for _, req := range s.requests {
		list = append(list, PendingRequestDTO{
			ID:        req.ID,
			Timestamp: req.Timestamp,
			Payload:   req.Payload,
		})
	}
	return list
}
