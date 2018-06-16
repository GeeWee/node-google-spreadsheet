import { forceArray, xmlSafeValue } from './utils';


export class SpreadsheetCell {
	private id: any;
	private row: number;
	private col: number;
	private batchId: string;
	private _formula: any;
	private _numericValue: number;
	private _value: string;
	private spreadsheet: any;
	private worksheet_id: any;
	private _needsSave: boolean;
	
	constructor(spreadsheet, worksheet_id, data){
		let links;
		this.spreadsheet = spreadsheet;
		this.worksheet_id = worksheet_id;
		
		this.id = data['id'];
		this.row = parseInt(data['gs:cell']['$']['row']);
		this.col = parseInt(data['gs:cell']['$']['col']);
		this.batchId = 'R'+this.row+'C'+this.col;
		
		this['_links'] = [];
		links = forceArray( data.link );
		links.forEach(( link ) => {
			this['_links'][ link['$']['rel'] ] = link['$']['href'];
		});
		
		this.updateValuesFromResponseData(data);
	}
	
	updateValuesFromResponseData = (_data) => {
		// formula value
		const input_val = _data['gs:cell']['$']['inputValue'];
		// inputValue can be undefined so substr throws an error
		// still unsure how this situation happens
		if (input_val && input_val.substr(0,1) === '='){
			this._formula = input_val;
		} else {
			this._formula = undefined;
		}
		
		// numeric values
		if (_data['gs:cell']['$']['numericValue'] !== undefined) {
			this._numericValue = parseFloat(_data['gs:cell']['$']['numericValue']);
		} else {
			this._numericValue = undefined;
		}
		
		// the main "value" - its always a string
		this.value = _data['gs:cell']['_'] || '';
	};
	
	setValue = (new_value, cb) => {
		this.value = new_value;
		this.save(cb);
	};
	
	_clearValue = () => {
		this._formula = undefined;
		this._numericValue = undefined;
		this.value = '';
	};
	
	save = (cb) => {
		if ( !cb ) cb = function(){};
		this._needsSave = false;
		
		const edit_id = 'https://spreadsheets.google.com/feeds/cells/key/worksheetId/private/full/R' + this.row + 'C' + this.col;
		let data_xml =
			'<entry><id>' + this.id + '</id>' +
			'<link rel="edit" type="application/atom+xml" href="' + this.id + '"/>' +
			'<gs:cell row="' + this.row + '" col="' + this.col + '" inputValue="' + this.valueForSave + '"/></entry>';
		
		data_xml = data_xml.replace('<entry>', "<entry xmlns='http://www.w3.org/2005/Atom' xmlns:gs='http://schemas.google.com/spreadsheets/2006'>");
		
		this.spreadsheet.makeFeedRequest( this['_links']['edit'], 'PUT', data_xml, (err, response) => {
			if (err) return cb(err);
			this.updateValuesFromResponseData(response);
			cb();
		});
	};
	
	del = (cb) => {
		this.setValue('', cb);
	};
	
	// GETTERS AND SETTERS
	get value(){
		return this._value;
	}
	set value(val){
		if (!val) {
			this._clearValue();
			return;
		}
		
		const numeric_val = parseFloat(val);
		if (!isNaN(numeric_val)){
			this._numericValue = numeric_val;
			this.value = val.toString();
		} else {
			this._numericValue = undefined;
			this.value = val;
		}
		
		if (typeof val == 'string' && val.substr(0,1) === '=') {
			// use the getter to clear the value
			this.formula = val;
		} else {
			this._formula = undefined;
		}
	}
	
	get formula(){
		return this._formula
	}
	
	set formula(val){
		if (!val) {
			this._clearValue();
			return;
		}
		
		if (val.substr(0,1) !== '=') {
			throw new Error('Formulas must start with "="');
		}
		this._numericValue = undefined;
		this.value = '*SAVE TO GET NEW VALUE*';
		this._formula = val;
	}
	
	get numericValue(){
		return this._numericValue
	}
	
	set numericValue(val){
		if (val === undefined || val === null) {
			this._clearValue();
			return;
		}
		
		if (isNaN(parseFloat(val as any)) || !isFinite(val)) {
			throw new Error('Invalid numeric value assignment');
		}
		
		this.value = val.toString();
		this._numericValue = parseFloat(val as any);
		this._formula = undefined;
	}
	
	get valueForSave(){
		return xmlSafeValue(this._formula || this.value);
	}
}
