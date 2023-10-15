export class ProcessControl {
    constructor(mainProcess = 0, hint1 = 0, hint2 = 0, hint3 = 0, isGameOver = false) {
        this.mainProcess = mainProcess;
        this.hint1 = hint1;//not start: 0
        this.hint2 = hint2;
        this.hint3 = hint3;
        this.isGameOver = isGameOver;
        this.isSuccess = this.mainProcess > 5;
    }

}