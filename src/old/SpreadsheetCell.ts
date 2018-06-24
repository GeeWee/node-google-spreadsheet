import { forceArray, xmlSafeValue } from './utils';
import { GoogleSpreadsheet } from './GoogleSpreadsheet';
import { Links, SpreadsheetCellData } from '../types';
import { isString } from 'util';
import * as _ from 'lodash';

export class SpreadsheetCell {
	private readonly id: string; // ????
	public readonly row: number;
	public readonly col: number;
	private readonly _links: Links;
	private batchId: string;
	private _formula: string | undefined;
	private _numericValue: number | undefined;
	private _value: string;
	private spreadsheet: GoogleSpreadsheet;
	private worksheet_id: number;

	constructor(
		spreadsheet: GoogleSpreadsheet,
		worksheet_id: number,
		data: SpreadsheetCellData,
	) {
		let links;
		this.spreadsheet = spreadsheet;
		this.worksheet_id = worksheet_id;

		this.id = data['id'];
		this.row = parseInt(data['gs:cell']['$']['row']);
		this.col = parseInt(data['gs:cell']['$']['col']);
		this.batchId = 'R' + this.row + 'C' + this.col;

		this._links = [];
		links = forceArray(data.link);
		links.forEach(link => {
			this._links[link['$']['rel']] = link['$']['href'];
		});

		this.updateValuesFromResponseData(data);
	}

	updateValuesFromResponseData = (_data: SpreadsheetCellData) => {
		// formula value
		const input_val = _data['gs:cell']['$']['inputValue'];
		// inputValue can be undefined so substr throws an error
		// still unsure how this situation happens
		if (input_val && input_val.substr(0, 1) === '=') {
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
		this._value = _data['gs:cell']['_'] || '';
	};

	setValue = async (new_value: string) => {
		this.value = new_value;
		return this.save(); //todo no callback
	};

	_clearValue = () => {
		this._formula = undefined;
		this._numericValue = undefined;
		this._value = '';
	};

	save = async () => {
		let data_xml =
			'<entry><id>' +
			this.id +
			'</id>' +
			'<link rel="edit" type="application/atom+xml" href="' +
			this.id +
			'"/>' +
			'<gs:cell row="' +
			this.row +
			'" col="' +
			this.col +
			'" inputValue="' +
			this.valueForSave +
			'"/></entry>';

		data_xml = data_xml.replace(
			'<entry>',
			"<entry xmlns='http://www.w3.org/2005/Atom' xmlns:gs='http://schemas.google.com/spreadsheets/2006'>",
		);

		const response = await this.spreadsheet.makeFeedRequest(
			this['_links']['edit'],
			'PUT',
			data_xml,
		);
		this.updateValuesFromResponseData(response.data);
	};

	del = async () => {
		return this.setValue('');
	};

	// GETTERS AND SETTERS
	get value() {
		return this._value;
	}
	set value(val: string | number | undefined) {
		if (!val) {
			this._clearValue();
			return;
		}

		if (_.isString(val)) {
			this._numericValue = undefined;
			this._value = val;
		} else {
			this._numericValue = val;
			this._value = val.toString();
		}

		if (typeof val == 'string' && val.substr(0, 1) === '=') {
			// use the getter to clear the value
			this.formula = val;
		} else {
			this._formula = undefined;
		}
	}

	get formula() {
		return this._formula;
	}

	set formula(val) {
		if (!val) {
			this._clearValue();
			return;
		}

		if (val.substr(0, 1) !== '=') {
			throw new Error('Formulas must start with "="');
		}
		this._numericValue = undefined;
		this._value = '*SAVE TO GET NEW VALUE*';
		this._formula = val;
	}

	get numericValue() {
		return this._numericValue;
	}

	set numericValue(val) {
		if (val === undefined || val === null) {
			this._clearValue();
			return;
		}

		if (isNaN(parseFloat(val as any)) || !isFinite(val)) {
			throw new Error('Invalid numeric value assignment');
		}

		this._value = val.toString();
		this._numericValue = parseFloat(val as any);
		this._formula = undefined;
	}

	get valueForSave() {
		return xmlSafeValue(this._formula || this._value);
	}
}