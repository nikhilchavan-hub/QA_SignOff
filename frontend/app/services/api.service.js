// API Service for QA Sign Off App
angular.module('qaSignOffApp').service('ApiService', ['$http', function($http) {
  var API_BASE = 'http://localhost:3000/api';
  
  var getAuthHeaders = function() {
    var token = localStorage.getItem('qa_token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  };

  this.signup = function(data) {
    return $http.post(API_BASE + '/signup', data);
  };
  
  this.login = function(data) {
    return $http.post(API_BASE + '/login', data);
  };
  
  this.getUser = function() {
    return $http.get(API_BASE + '/user/me', { headers: getAuthHeaders() });
  };
  
  this.getSignOffDetails = function(params) {
    return $http.get(API_BASE + '/signOffDetails', { 
      params: params, 
      headers: getAuthHeaders() 
    });
  };
  
  this.getVDS = function() {
    return $http.get(API_BASE + '/getVDS', { headers: getAuthHeaders() });
  };
  
  this.createSignOff = function(data) {
    return $http.post(API_BASE + '/signoffs', data, { headers: getAuthHeaders() });
  };
  
  this.getSignOffById = function(id) {
    return $http.get(API_BASE + '/signoffs/' + id, { headers: getAuthHeaders() });
  };
  
  this.updateSignOff = function(id, data) {
    return $http.put(API_BASE + '/signoffs/' + id, data, { headers: getAuthHeaders() });
  };

  // Knowledge Share APIs
  this.getKnowledgeShare = function() {
    return $http.get(API_BASE + '/knowledge-share', { headers: getAuthHeaders() });
  };

  this.createKnowledgeShare = function(formData) {
    var headers = getAuthHeaders();
    headers['Content-Type'] = undefined; // Let browser set content-type for FormData
    return $http.post(API_BASE + '/knowledge-share', formData, { 
      headers: headers,
      transformRequest: angular.identity
    });
  };

  this.downloadKnowledgeFile = function(id) {
    return $http.get(API_BASE + '/knowledge-share/' + id + '/download', { 
      headers: getAuthHeaders(),
      responseType: 'blob'
    });
  };
}]);