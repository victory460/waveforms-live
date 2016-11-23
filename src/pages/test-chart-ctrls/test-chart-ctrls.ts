import { ToastController, App, Platform } from 'ionic-angular';
import { ViewChild, Component } from '@angular/core';

//Components
import { SilverNeedleChart } from '../../components/chart/chart.component';
import { DeviceComponent } from '../../components/device/device.component';
import { TriggerComponent } from '../../components/trigger/trigger.component';


//Services
import { DeviceManagerService } from '../../services/device/device-manager.service';
import { StorageService } from '../../services/storage/storage.service';


@Component({
    templateUrl: 'test-chart-ctrls.html'
})
export class TestChartCtrlsPage {
    @ViewChild('chart1') chart1: SilverNeedleChart;
    @ViewChild('triggerComponent') triggerComponent: TriggerComponent;
    public app: App;
    public platform: Platform;
    public controlsVisible = false;
    public botVisible = false;
    public sideVisible = false;
    public running: boolean = false;
    public triggerStatus: string = 'Idle';

    public deviceManagerService: DeviceManagerService;
    public activeDevice: DeviceComponent;
    public storage: StorageService;

    public oscopeChans: number[];

    public chartReady: boolean = false;
    public toastCtrl: ToastController;
    public clickBindReference;
    public readAttemptCount: number = 0;
    public previousOscSettings: any[] = [{
        offset: null,
        gain: null,
        sampleFreqMax: null,
        bufferSizeMax: null,
        delay: null
    }, {
        offset: null,
        gain: null,
        sampleFreqMax: null,
        bufferSizeMax: null,
        delay: null
    }];
    public previousTrigSettings: any = {
        instrument: null,
        channel: null,
        type: null,
        lowerThreshold: null,
        upperThreshold: null
    };

    constructor(_deviceManagerService: DeviceManagerService, _storage: StorageService, _toastCtrl: ToastController, _app: App, _platform: Platform) {
        this.toastCtrl = _toastCtrl;
        this.app = _app;
        this.platform = _platform;
        this.deviceManagerService = _deviceManagerService;
        this.activeDevice = this.deviceManagerService.getActiveDevice();
        this.storage = _storage;
    }

    requestFullscreen() {
        let conf = confirm("Fullscreen mode?");
        let docelem: any = document.documentElement;

        if (conf == true) {
            if (docelem.requestFullscreen) {
                docelem.requestFullscreen();
            }
            else if (docelem.mozRequestFullScreen) {
                docelem.mozRequestFullScreen();
            }
            else if (docelem.webkitRequestFullScreen) {
                docelem.webkitRequestFullScreen();
            }
            else if (docelem.msRequestFullscreen) {
                docelem.msRequestFullscreen();
            }
        }
        document.getElementById('instrument-panel-container').removeEventListener('click', this.clickBindReference);
    }

    //Alert user with toast if no active device is set
    ngOnInit() {
        if (this.deviceManagerService.activeDeviceIndex === undefined) {
            console.log('in if');
            let toast = this.toastCtrl.create({
                message: 'You currently have no device connected. Please visit the settings page.',
                showCloseButton: true
            });

            toast.present();
        }
        else {
            this.oscopeChans = [0, 1];
            this.chartReady = true;
            this.chart1.loadDeviceSpecificValues(this.activeDevice);
        }
    }

    ionViewDidEnter() {
        this.app.setTitle('Instrument Panel');
        if (this.platform.is('android')) {
            //Have to create bind reference to remove listener since .bind creates new function reference
            this.clickBindReference = this.requestFullscreen.bind(this);
            document.getElementById('instrument-panel-container').addEventListener('click', this.clickBindReference);
        }
    }

    //Toggle sidecontrols
    toggleControls() {
        this.controlsVisible = !this.controlsVisible;
    }

    //Toggle bot controls 
    toggleBotControls() {
        this.botVisible = !this.botVisible;
    }

    //Run osc single
    singleClick() {
        console.log('single clicked');
        if (this.chart1.oscopeChansActive.indexOf(true) === -1 ) {
            let toast = this.toastCtrl.create({
                message: 'Err: No Channels Active. Please Activate a Channel and Run Again',
                showCloseButton: true,
                position: 'bottom'
            });
            toast.present();
            return;
        }
        this.triggerStatus = 'Armed';
        let setTrigParams = false;
        let setOscParams = false;

        let trigSourceArr = this.triggerComponent.triggerSource.split(' ');
        if (trigSourceArr[2] === undefined) {
            trigSourceArr[2] = '1';
        }
        let trigType;
        switch (this.triggerComponent.edgeDirection) {
            case 'rising': trigType = 'risingEdge'; break;
            case 'falling': trigType = 'fallingEdge'; break;
            default: trigType = 'risingEdge';
        }
        if (this.previousTrigSettings.instrument !== trigSourceArr[0] || this.previousTrigSettings.channel !== parseInt(trigSourceArr[2]) ||
            this.previousTrigSettings.type !== trigType || this.previousTrigSettings.lowerThreshold !== parseInt(this.triggerComponent.lowerThresh) ||
            this.previousTrigSettings.upperThreshold !== parseInt(this.triggerComponent.upperThresh)) {
            setTrigParams = true;
        }

        let readArray = [[], [], [], [], [], []];
        for (let i = 0; i < this.chart1.oscopeChansActive.length; i++) {
            if (this.chart1.oscopeChansActive[i]) {
                let range = this.chart1.voltsPerDivVals[this.chart1.activeVPDIndex[i]] * 10;
                let j = 0;
                while (range * this.activeDevice.instruments.osc.chans[i].gains[j] > this.activeDevice.instruments.osc.chans[i].adcVpp / 1000) {
                    j++;
                }

                if (this.previousOscSettings[i].offset !== 0 || this.previousOscSettings[i].gain !== this.activeDevice.instruments.osc.chans[i].gains[j] ||
                    this.previousOscSettings[i].sampleFreqMax !== this.activeDevice.instruments.osc.chans[i].sampleFreqMax / 1000 ||
                    this.previousOscSettings[i].bufferSizeMax !== this.activeDevice.instruments.osc.chans[i].bufferSizeMax ||
                    this.previousOscSettings[i].delay !== parseFloat(this.triggerComponent.delay)) {
                    setOscParams = true;
                    setTrigParams = true;
                }

                readArray[0].push(i + 1);
                readArray[1].push(0);
                readArray[2].push(this.activeDevice.instruments.osc.chans[i].gains[j]);
                readArray[3].push(this.activeDevice.instruments.osc.chans[i].sampleFreqMax / 1000);
                readArray[4].push(this.activeDevice.instruments.osc.chans[i].bufferSizeMax);
                readArray[5].push(parseFloat(this.triggerComponent.delay));
                this.previousOscSettings[i] = {
                    offset: 0,
                    gain: this.activeDevice.instruments.osc.chans[i].gains[j],
                    sampleFreqMax: this.activeDevice.instruments.osc.chans[i].sampleFreqMax / 1000,
                    bufferSizeMax: this.activeDevice.instruments.osc.chans[i].bufferSizeMax,
                    delay: parseFloat(this.triggerComponent.delay)
                }
            }
        }
        let singleCommand = {}

        if (setOscParams) {
            singleCommand['osc'] = {};
            singleCommand['osc']['setParameters'] = [readArray[0], readArray[1], readArray[2], readArray[3], readArray[4], readArray[5]];
        }
        singleCommand['trigger'] = {};
        if (setTrigParams) {
            singleCommand['trigger']['setParameters'] = [
                [1],
                [
                    {
                        instrument: trigSourceArr[0].toLowerCase(),
                        channel: parseInt(trigSourceArr[2]),
                        type: trigType,
                        lowerThreshold: parseInt(this.triggerComponent.lowerThresh),
                        upperThreshold: parseInt(this.triggerComponent.upperThresh)
                    }
                ],
                [
                    {
                        osc: readArray[0],
                        //la: [1]
                    }
                ]
            ];
        }

        //TODO if trigger single error, send whole set parameter multi command.
        singleCommand['trigger']['single'] = [[1]];
        /*if (this.triggerComponent.edgeDirection === 'off') {
            singleCommand['trigger']['forceTrigger'] = [[1]];
        }*/

        this.activeDevice.multiCommand(singleCommand).subscribe(
            (data) => {
                console.log(data);
            },
            (err) => {
                console.log(err);
                this.triggerStatus = 'Idle';
            },
            () => {
                this.readOscope();
                //this.readLa();
            }
        );

        this.previousTrigSettings = {
            instrument: trigSourceArr[0],
            channel: parseInt(trigSourceArr[2]),
            type: trigType,
            lowerThreshold: parseInt(this.triggerComponent.lowerThresh),
            upperThreshold: parseInt(this.triggerComponent.upperThresh)
        };


    }

    readLa() {
        this.activeDevice.instruments.la.read([1]).subscribe(
            (data) => {
                
            },
            (err) => {

            },
            () => { }
        );
    }

    readOscope() {
        let readArray = [];
        for (let i = 0; i < this.chart1.oscopeChansActive.length; i++) {
            if (this.chart1.oscopeChansActive[i]) {
                readArray.push(i + 1);
            }
        }
        this.activeDevice.instruments.osc.read(readArray).subscribe(
            (data) => {

                this.readAttemptCount = 0;
                let numSeries = [];
                for (let i = 0; i < this.chart1.oscopeChansActive.length; i++) {
                    if (this.chart1.oscopeChansActive[i]) {
                        numSeries.push(i);
                    }
                }
                this.chart1.clearExtraSeries(numSeries);
                if (this.activeDevice.instruments.osc.dataBufferWriteIndex - 1 < 0) {
                    this.chart1.setCurrentBuffer(this.activeDevice.instruments.osc.dataBuffer[this.activeDevice.instruments.osc.dataBuffer.length - 1]);
                }
                else {
                    this.chart1.setCurrentBuffer(this.activeDevice.instruments.osc.dataBuffer[this.activeDevice.instruments.osc.dataBufferWriteIndex - 1]);
                }
                let start = performance.now();
                this.chart1.flotDrawWaveform(true, false);
                let finish = performance.now();
                console.log('decimate and draw: ' + (finish - start));
                this.triggerStatus = 'Idle';
            },
            (err) => {
                if (this.readAttemptCount > 5) {
                    console.log(err);
                    let toast = this.toastCtrl.create({
                        message: err,
                        showCloseButton: true
                    });
                    toast.present();
                    this.triggerStatus = 'Idle';
                }
                else {
                    console.log('attempting read again');
                    this.readAttemptCount++;
                    setTimeout(() => {
                        this.readOscope();
                    }, 100);
                }
            },
            () => {
            }
        );
    }

    //Stream osc buffers
    runClick() {
        let toast = this.toastCtrl.create({
            message: 'Run Not Implemented',
            duration: 3000,
            position: 'bottom'
        });
        toast.present();
    }

    //Stop dc stream
    stopClick() {
        console.log('stop');
        this.running = false;
        this.activeDevice.instruments.osc.stopStream();
    }

    //Enable cursors and timeline view
    initSettings() {
        this.chart1.enableCursors();
        this.chart1.enableTimelineView();
        this.chart1.enableMath();
    }
}
