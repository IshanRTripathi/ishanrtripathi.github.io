import { Game } from './Game.js'

export class MovementAdapter
{
    constructor()
    {
        this.game = Game.getInstance()
    }

    moveTo(position, rotation = null)
    {
        this.game.physicalVehicle.moveTo(position, rotation)
    }

    activate()
    {
        if(this.game.physicalVehicle.activate)
            this.game.physicalVehicle.activate()
    }

    deactivate()
    {
        if(this.game.physicalVehicle.deactivate)
            this.game.physicalVehicle.deactivate()
    }

    getPosition()
    {
        return this.game.physicalVehicle.position
    }

    getQuaternion()
    {
        return this.game.physicalVehicle.quaternion
    }

    getSpeed()
    {
        return this.game.physicalVehicle.speed
    }
}
