import React, { Component } from 'react';
import { CSVLink } from "react-csv";
import { Row, Col, Form, Button } from 'react-bootstrap';
import _ from 'lodash';

class SellCSV extends Component {
  constructor(props) {
    super(props);
    this.state = {
      interestRate: 4.5,
      mortgagePeriod: 30,
      ratioPerThousand: 5.07,
      adjustedSQFT: 200,
      data: [],
      referenceData: [],
      results: [],
    };
    this.handleInputChange = this.handleInputChange.bind(this);
  }

  csvToObj(csv) {
    if (_.isNil(csv)) {
      return;
    }

    csv = csv.trim();
    var lines = csv.split('\r');
    var result = [];
    var headers = lines[0].split(',');
    headers = headers.map(function(h) {
      return h.trim().replace(/"/g, '');
    });

    for(var i=1; i<lines.length; i++) {
      var obj = {};
      var currentline = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      for(var j=0; j<headers.length; j++){
        obj[headers[j]] = currentline[j].trim().replace(/['"]+/g, '');
      }
      result.push(obj);
    }
    return result;
  }

  convertToNumber(v) {
    if (_.isNil(v)) {
      return 0;
    }
    return _.toNumber(v.replace(/\$|,/g, ""));
  }

  cleanup = () => {
    this.setState({data: [], referenceData: [], results: []});
  }

  financeCost = (row) => {
    const currentPrice = this.convertToNumber(_.get(row, 'Current Price'));
    if (_.isNil(currentPrice)) {
      return;
    }
    const ratioPerThousand = this.state.ratioPerThousand;
    row.financeCost = _.round(currentPrice / 1000 * ratioPerThousand, 2);
    return row;
  }

  monthlyTax = (row) => {
    if (_.isNil(_.get(row, 'Tax Annual Amount'))) {
      return;
    }
    row.monthlyTax = _.round(this.convertToNumber(_.get(row, 'Tax Annual Amount')) / 12, 2);
    return row;
  }

  totalCost = (row) => {
    const condoFee = _.isNil(_.get(row, 'Condo/Coop Fee')) ? 0 : this.convertToNumber(_.get(row, 'Condo/Coop Fee'));
    const hoaFee = _.isNil(_.get(row, 'HOA Fee')) ? 0 : this.convertToNumber(_.get(row, 'Condo/Coop Fee'));
    row.totalCost =  _.round(_.get(row, 'financeCost') + _.get(row, 'monthlyTax') + condoFee + hoaFee);
    return row;
  }

  rentalAvgIncome = (row) => {
    const currentSQFT = this.convertToNumber(_.get(row, 'Above Grade Finished SQFT'));
    const currentBed = this.convertToNumber(_.get(row, 'Beds'));
    const currentSubdivision = _.get(row, 'Legal Subdivision') ? _.get(row, 'Legal Subdivision') : _.get(row, 'Subdivision/Neighborhood');
    if (_.isNil(currentSQFT)) {
      return;
    }
    const data = this.state.referenceData;
    let qualifiedSQFTs = _.filter(data, (o, i) => {
      const sqft = this.convertToNumber(_.get(data[i], 'Above Grade Finished SQFT'));
      const bed = this.convertToNumber(_.get(data[i], 'Beds'));
      const subdivision = _.get(data[i], 'Legal Subdivision') ? _.get(data[i], 'Legal Subdivision') : _.get(data[i], 'Subdivision/Neighborhood');
      const adjustedSQFT = this.state.adjustedSQFT;
      return (_.isEqual(subdivision, currentSubdivision) && _.isEqual(currentBed, bed) && (sqft > currentSQFT - adjustedSQFT && sqft < currentSQFT + adjustedSQFT));
    });
    const sumPrice = _.sumBy(qualifiedSQFTs, (o) => {
      return this.convertToNumber(_.get(o, 'Current Price'));
    });
    row.rentalAvgIncome = _.round(sumPrice / qualifiedSQFTs.length, 2);
    return row;
  }

  returnRate = (row) => {
    row.returnRate = _.round(_.get(row, 'rentalAvgIncome') / _.get(row, 'totalCost'), 2);
    return row;
  }

  nominalAmount = (row) => {
    const rentalAvgIncome = _.get(row, 'rentalAvgIncome');
    const totalCost = _.get(row, 'totalCost');
    if (_.isNil(rentalAvgIncome) || _.isNil(totalCost)) {
      return;
    }
    row.nominalAmount = _.round(rentalAvgIncome - totalCost, 2);
    return row;
  }

  ratio = (row) => {
    const taxAssessedValue = this.convertToNumber(_.get(row, 'Tax Assessed Value'));
    const currentPrice = this.convertToNumber(_.get(row, 'Current Price'));
    if (_.isNil(taxAssessedValue) && _.isNil(currentPrice)) {
      return;
    }
    row.ratio = _.round(taxAssessedValue / currentPrice, 2);
    return row;
  }

  depreciation = (row) => {
    const currentPrice = this.convertToNumber(_.get(row, 'Current Price'));
    if (_.isNil(currentPrice)) {
      return;
    }
    row.depreciation = _.round((currentPrice / 27.5) * 0.3, 2);
    return row;
  }

  apprecitation = (row) => {
    const currentPrice = this.convertToNumber(_.get(row, 'Current Price'));
    if (_.isNil(currentPrice)) {
      return;
    }
    row.apprecitation = _.round(currentPrice * 0.03, 2);
    return row;
  }

  monthlyPayment(loanAmount, apr, mortgagePeriod) {
    if (_.isNumber(apr) && _.isEqual(apr, 0)) {
      return 0;
    }
    const r = apr / 12;
    const n = mortgagePeriod * 12;
    const m = loanAmount * (r * (Math.pow((1 + r), n))) / (Math.pow((1 + r), n) - 1);
    return Math.round(m, 2)
  }

  paymentAmount = (row) => {
    const currentPrice = this.convertToNumber(_.get(row, 'Current Price'));
    if (_.isNil(currentPrice)) {
      return;
    }
    row.paymentAmount = this.monthlyPayment(currentPrice, this.state.interestRate / 100, this.state.mortgagePeriod);
    return row;
  }

  getCSV = () => {
    const data = this.state.data;
    if (data === null) return;
    let results = [];
    results = _.map(data, this.financeCost);
    results = _.map(results, this.paymentAmount);
    results = _.map(results, this.monthlyTax);
    results = _.map(results, this.totalCost);
    results = _.map(results, this.rentalAvgIncome);
    results = _.map(results, this.returnRate);
    results = _.map(results, this.nominalAmount);
    results = _.map(results, this.ratio);
    results = _.map(results, this.depreciation);
    results = _.map(results, this.apprecitation);
    this.setState({results: results});
  }

  handleSellData = (e) => {
    let reader = new FileReader();
    const that = this;
    reader.onload = (e) => {
      const obj = that.csvToObj(e.target.result);
      this.setState({data: obj});
    }
    reader.readAsText(e.target.files[0]);
  }

  handleReferenceData = (e) => {
    const that = this;
    let files = _.get(e, 'target.files');
    for (let i = 0; i < files.length; i++) {
      let reader = new FileReader();
      reader.onload = (e) => {
        const obj = that.csvToObj(e.target.result);
        this.setState({referenceData: [...this.state.referenceData, ...obj]});
      }
      reader.readAsText(e.target.files[i]);
    }

  }

  handleInputChange(e) {
    const target = e.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;
    this.setState({
      [name]: value
    });
    if (name === 'interestRate') {
      this.setState((previousState, currentProps) => {
          if (_.chain(previousState.interestRate).toNumber().isNumber().value()) {
            const ratioPerThousand = this.monthlyPayment(1000, previousState.interestRate / 100, previousState.mortgagePeriod);
            return { ...previousState, ratioPerThousand: ratioPerThousand };
          }
      });
    }

  }

  render() {
    return (
        <Form>
          <Form.Group as={Row}>
            <Form.Label column sm="3">
              Input Interest Rate (default is 4.5):
            </Form.Label>
            <Col sm="9">
              <Form.Control name="interestRate" type="number" value={this.state.interestRate} onChange={this.handleInputChange} />
            </Col>
          </Form.Group>

          <Form.Group as={Row}>
            <Form.Label column sm="3">
              mortgage Period:
            </Form.Label>
            <Col sm="9">
              <Form.Control name="mortgagePeriod" type="number" value={this.state.mortgagePeriod} onChange={this.handleInputChange} />
            </Col>
          </Form.Group>

          <Form.Group as={Row}>
            <Form.Label column sm="3">
              Input Ratio per 1000:
            </Form.Label>
            <Col sm="9">
              <Form.Control name="ratioPerThousand" plaintext readOnly value={this.state.ratioPerThousand} />
            </Col>
          </Form.Group>

          <Form.Group as={Row}>
            <Form.Label column sm="3">
              Input Adjusted SQFT:
            </Form.Label>
            <Col sm="9">
              <Form.Control name="adjustedSQFT" type="number" value={this.state.adjustedSQFT} onChange={this.handleInputChange} />
            </Col>
          </Form.Group>

          <Form.Group as={Row}>
            <Form.Label column sm="3">
              Upload Sell CSV:
            </Form.Label>
            <Col sm="9">
              <input
                type="file"
                placeholder='Upload Sell CSV...'
                onChange={this.handleSellData}
              />
            </Col>
          </Form.Group>

          <Form.Group as={Row}>
            <Form.Label column sm="3">
              Upload Rental CSV:
            </Form.Label>
            <Col sm="9">
              <input
                type="file"
                placeholder='Upload Rental CSV...'
                onChange={this.handleReferenceData}
                multiple
              />
            </Col>
          </Form.Group>

          <Row>
          <Col sm="2">
            <Button variant="info" onClick={this.getCSV}>Generate Result</Button>
          </Col>
          <Col sm="3">
            {
              this.state.results.length > 0 &&
              <CSVLink
                className="btn btn-success"
                data={this.state.results}
                filename="sell.csv"
                onClick={this.cleanup}
              >
              Export Sell CSV File
              </CSVLink>
            }
          </Col>
          </Row>
        </Form>
    );
  }
}

export { SellCSV as default };
